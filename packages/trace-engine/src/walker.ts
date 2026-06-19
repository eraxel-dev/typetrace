import * as ts from "typescript";

import type { TraceStep } from "@unravel/shared";

import { rememberType } from "./cache.js";
import type { StepIdGenerator } from "./utils.js";
import { typeToString } from "./utils.js";

/**
 * Guard against pathological recursion. Recursive / self-referential types are
 * out of scope for v0.1, but conditional and union resolution can still revisit
 * the same type object (e.g. distributive conditionals), so we track visited
 * type objects and cap the traversal depth defensively.
 */
const MAX_DEPTH = 64;

/**
 * Shared state threaded through a single {@link walkType} traversal. Holding the
 * checker, the id generator and the visited set together keeps the recursive
 * signature small and ensures step IDs stay monotonic across the whole walk.
 */
interface WalkContext {
  checker: ts.TypeChecker;
  ids: StepIdGenerator;
  steps: TraceStep[];
  visited: Set<ts.Type>;
}

/**
 * Recursively walk a resolved type, appending a {@link TraceStep} for each
 * transformation the checker performed to reach it. Three kinds are emitted in
 * v0.1: `"union"` (member expansion), `"conditional"` (extends check + resolved
 * branch) and `"infer"` (type-parameter instantiation). Intersection and mapped
 * kinds are intentionally never emitted.
 *
 * Steps are pushed onto `steps` in traversal order; the function mutates that
 * array and returns nothing.
 */
export function walkType(
  type: ts.Type,
  steps: TraceStep[],
  checker: ts.TypeChecker,
  ids: StepIdGenerator,
): void {
  walk(type, { checker, ids, steps, visited: new Set() }, 0);
}

function walk(type: ts.Type, ctx: WalkContext, depth: number): void {
  if (depth >= MAX_DEPTH || ctx.visited.has(type)) {
    return;
  }
  ctx.visited.add(type);
  rememberType(type);

  if (type.flags & ts.TypeFlags.Union) {
    if (!isSynthesizedBoolean(type as ts.UnionType)) {
      walkUnion(type as ts.UnionType, ctx, depth);
    }
    return;
  }

  if (type.flags & ts.TypeFlags.Conditional) {
    walkConditional(type as ts.ConditionalType, ctx, depth);
    return;
  }

  if (type.flags & ts.TypeFlags.TypeParameter) {
    walkTypeParameter(type as ts.TypeParameter, ctx, depth);
  }
}

/**
 * The intrinsic `boolean` type is modelled by the checker as a union of the
 * literals `true | false`. Treating it as a real union would emit two spurious
 * "union member" steps for what users perceive as an indivisible primitive, so
 * it is excluded from expansion. A union is the synthesized boolean when every
 * constituent is a boolean literal.
 */
function isSynthesizedBoolean(type: ts.UnionType): boolean {
  return (
    type.types.length > 0 &&
    type.types.every((member) => (member.flags & ts.TypeFlags.BooleanLiteral) !== 0)
  );
}

function walkUnion(type: ts.UnionType, ctx: WalkContext, depth: number): void {
  const sourceType = typeToString(ctx.checker, type);
  for (const constituent of type.types) {
    ctx.steps.push({
      id: ctx.ids.next(),
      kind: "union",
      sourceType,
      targetType: typeToString(ctx.checker, constituent),
      reason: "union member",
    });
    walk(constituent, ctx, depth + 1);
  }
}

function walkConditional(type: ts.ConditionalType, ctx: WalkContext, depth: number): void {
  ctx.steps.push({
    id: ctx.ids.next(),
    kind: "conditional",
    sourceType: typeToString(ctx.checker, type.checkType),
    targetType: typeToString(ctx.checker, type.extendsType),
    reason: "conditional check",
  });

  // Forward-looking scaffolding for *deferred* conditionals whose branches the
  // checker has already resolved. The task spec mandates emitting a resolved
  // branch step, but empirically the checker never surfaces such a type through
  // getTypeAtLocation / getReturnTypeOfSignature: a conditional with a concrete
  // check type is collapsed to its result (losing the Conditional flag) before
  // we observe it, while one with a generic check type stays deferred with both
  // resolvedTrueType and resolvedFalseType absent. This path is therefore
  // validated by direct walkType unit injection (see index.test.ts) rather than
  // an end-to-end fixture, and is retained for later TypeScript versions that
  // may expose resolved-branch deferred conditionals. Do not treat as dead code.
  const branch = resolveConditionalBranch(type);
  if (branch === undefined) {
    return;
  }

  ctx.steps.push({
    id: ctx.ids.next(),
    kind: "conditional",
    sourceType: typeToString(ctx.checker, type),
    targetType: typeToString(ctx.checker, branch.type),
    reason: branch.taken ? "conditional true branch" : "conditional false branch",
  });

  walk(branch.type, ctx, depth + 1);
}

/**
 * Pick the resolved branch of a conditional type. The checker fully resolves a
 * conditional once its check type is concrete, populating exactly one of
 * `resolvedTrueType` / `resolvedFalseType`. When neither is populated the
 * conditional is still deferred (its check type is generic), so there is no
 * branch to follow and we return `undefined`.
 */
function resolveConditionalBranch(
  type: ts.ConditionalType,
): { type: ts.Type; taken: boolean } | undefined {
  if (type.resolvedTrueType !== undefined) {
    return { type: type.resolvedTrueType, taken: true };
  }
  if (type.resolvedFalseType !== undefined) {
    return { type: type.resolvedFalseType, taken: false };
  }
  return undefined;
}

function walkTypeParameter(type: ts.TypeParameter, ctx: WalkContext, depth: number): void {
  const instantiated = resolveTypeParameterInstantiation(type, ctx.checker);
  if (instantiated === undefined) {
    return;
  }

  const targetType = typeToString(ctx.checker, instantiated);
  // v0.1 approximates infer-position inference via the type parameter's base
  // constraint. For `<T extends string>` the checker reports `string` as the
  // parameter's *upper bound*, not a value inferred for T, so the reason string
  // must describe a constraint rather than claim an inference the code cannot
  // substantiate. The step kind stays "infer" because the task's TypeFlags
  // mapping table maps TypeFlags.TypeParameter-with-constraint to "infer", and
  // the shared TraceStepKind union admits only the five named kinds. Genuine
  // `infer U` position detection is deferred to a later version.
  ctx.steps.push({
    id: ctx.ids.next(),
    kind: "infer",
    sourceType: typeToString(ctx.checker, type),
    targetType,
    reason: `type parameter constrained to ${targetType}`,
  });

  walk(instantiated, ctx, depth + 1);
}

/**
 * Resolve the type a type-parameter was inferred / instantiated as. The base
 * constraint is the checker's public window onto that instantiation: it
 * transitively resolves a parameter's constraint to a concrete type (or
 * `undefined` when none exists). If it yields a concrete type distinct from the
 * parameter itself, that is the inferred instantiation; an unconstrained or
 * self-resolving parameter has no inference to report.
 */
function resolveTypeParameterInstantiation(
  type: ts.TypeParameter,
  checker: ts.TypeChecker,
): ts.Type | undefined {
  const constraint = checker.getBaseConstraintOfType(type);
  if (constraint === undefined || constraint === type) {
    return undefined;
  }
  return constraint;
}
