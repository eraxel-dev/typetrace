import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProjectContext, TraceStep } from "@typetrace/shared";

import {
  clearTraceCaches,
  getCachedTrace,
  getCachedType,
  getTypeId,
  rememberType,
  setCachedTrace,
} from "./cache.js";
import { traceNode } from "./index.js";
import { createStepIdGenerator, typeToString } from "./utils.js";
import { walkType } from "./walker.js";

/**
 * Each test compiles a throwaway TypeScript source written to a fresh temp
 * directory, so cases never share fixtures on disk. The module-level trace and
 * type caches are cleared before and after every test to keep the suite
 * order-independent.
 */

let projectDir: string;

interface Fixture {
  context: ProjectContext;
  sourceFile: ts.SourceFile;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
};

function buildFixture(source: string, fileName = "index.ts"): Fixture {
  const filePath = join(projectDir, fileName);
  writeFileSync(filePath, source);

  const program = ts.createProgram({
    rootNames: [filePath],
    options: COMPILER_OPTIONS,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error(`fixture source file not found: ${filePath}`);
  }
  return { context: { program, checker }, sourceFile };
}

/** Locate the `name` identifier node of a top-level `const`/`let`/`var`. */
function findVariableNode(sourceFile: ts.SourceFile, name: string): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node.name;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found === undefined) {
    throw new Error(`variable '${name}' not found in fixture`);
  }
  return found;
}

/** Locate the first type-parameter declaration node of a named function. */
function findFunctionTypeParam(sourceFile: ts.SourceFile, fnName: string): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === fnName &&
      node.typeParameters !== undefined &&
      node.typeParameters.length > 0
    ) {
      found = node.typeParameters[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found === undefined) {
    throw new Error(`type parameter of '${fnName}' not found in fixture`);
  }
  return found;
}

/** Resolve the declared type of a named type alias (stays generic / deferred). */
function declaredAliasType(
  context: ProjectContext,
  sourceFile: ts.SourceFile,
  aliasName: string,
): ts.Type {
  let symbol: ts.Symbol | undefined;
  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === aliasName) {
      symbol = context.checker.getSymbolAtLocation(node.name);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (symbol === undefined) {
    throw new Error(`type alias '${aliasName}' not found in fixture`);
  }
  return context.checker.getDeclaredTypeOfSymbol(symbol);
}

/**
 * Build a real, checker-backed deferred {@link ts.ConditionalType} from a
 * `T extends string ? ... : ...` alias, then attach the supplied resolved
 * branch types. Mutating a genuine conditional (rather than fabricating a plain
 * object) keeps it stringifiable by `checker.typeToString`, which a hand-rolled
 * fake is not. This is the only reliable way to exercise the resolved-branch
 * path: the checker collapses any conditional with a concrete check type to its
 * result before it ever reaches `getTypeAtLocation`, while a conditional with a
 * generic check type stays deferred with BOTH resolved branches absent. No real
 * fixture can therefore drive the spec-mandated resolved-branch logic
 * end-to-end, so it is validated here by direct injection of resolved branches
 * onto a real deferred conditional (see the matching scaffolding note in
 * walker.ts:walkConditional).
 */
function buildConditional(
  context: ProjectContext,
  sourceFile: ts.SourceFile,
  branches: { resolvedTrueType?: ts.Type; resolvedFalseType?: ts.Type },
): ts.Type {
  const conditional = declaredAliasType(context, sourceFile, "Cond") as ts.Type & {
    resolvedTrueType?: ts.Type;
    resolvedFalseType?: ts.Type;
  };
  conditional.resolvedTrueType = branches.resolvedTrueType;
  conditional.resolvedFalseType = branches.resolvedFalseType;
  return conditional;
}

const CONDITIONAL_FIXTURE = "type Cond<T> = T extends string ? 'yes' : 'no';\nexport const x = 1;\n";

beforeEach(() => {
  clearTraceCaches();
  projectDir = mkdtempSync(join(tmpdir(), "unravel-trace-engine-"));
});

afterEach(() => {
  clearTraceCaches();
  rmSync(projectDir, { recursive: true, force: true });
});

describe("traceNode — union", () => {
  it("emits one union step per constituent and recurses into each", () => {
    const { context, sourceFile } = buildFixture(
      "export const value: string | number = 1;\n",
    );
    const node = findVariableNode(sourceFile, "value");

    const result = traceNode(node, context);

    expect(result.symbol).toBe("value");
    expect(result.finalType).toBe("string | number");
    expect(result.steps).toHaveLength(2);
    expect(result.steps.every((s) => s.kind === "union")).toBe(true);
    expect(result.steps.map((s) => s.id)).toEqual(["1", "2"]);
    for (const step of result.steps) {
      expect(step.sourceType).toBe("string | number");
      expect(step.reason).toBe("union member");
    }
    expect(result.steps.map((s) => s.targetType).sort()).toEqual(["number", "string"]);
  });

  it("expands a union that includes null", () => {
    const { context, sourceFile } = buildFixture(
      "export const value: string | null = null;\n",
    );
    const node = findVariableNode(sourceFile, "value");

    const result = traceNode(node, context);

    expect(result.steps.every((s) => s.kind === "union")).toBe(true);
    expect(result.steps.map((s) => s.targetType).sort()).toEqual(["null", "string"]);
  });
});

describe("traceNode — conditional", () => {
  it("emits a conditional check step for a deferred conditional type", () => {
    const { context, sourceFile } = buildFixture(
      "type Cond<T> = T extends string ? 'yes' : 'no';\nexport const x = 1;\n",
    );
    const condType = declaredAliasType(context, sourceFile, "Cond");

    expect(condType.flags & ts.TypeFlags.Conditional).toBeTruthy();

    const steps: TraceStep[] = [];
    walkType(condType, steps, context.checker, createStepIdGenerator());

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      id: "1",
      kind: "conditional",
      sourceType: "T",
      targetType: "string",
      reason: "conditional check",
    });
  });

  it("follows the resolved true branch when present", () => {
    const { context, sourceFile } = buildFixture(CONDITIONAL_FIXTURE);
    const checker = context.checker;
    const conditional = buildConditional(context, sourceFile, {
      resolvedTrueType: checker.getNumberType(),
    });

    const steps: TraceStep[] = [];
    walkType(conditional, steps, checker, createStepIdGenerator());

    expect(steps).toHaveLength(2);
    expect(steps[0]?.kind).toBe("conditional");
    expect(steps[0]?.reason).toBe("conditional check");
    expect(steps[1]).toMatchObject({
      id: "2",
      kind: "conditional",
      targetType: "number",
      reason: "conditional true branch",
    });
  });

  it("follows the resolved false branch when the true branch is absent", () => {
    const { context, sourceFile } = buildFixture(CONDITIONAL_FIXTURE);
    const checker = context.checker;
    const conditional = buildConditional(context, sourceFile, {
      resolvedFalseType: checker.getNumberType(),
    });

    const steps: TraceStep[] = [];
    walkType(conditional, steps, checker, createStepIdGenerator());

    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({
      id: "2",
      kind: "conditional",
      targetType: "number",
      reason: "conditional false branch",
    });
  });
});

describe("traceNode — infer", () => {
  it("emits an infer step for a constrained type parameter", () => {
    const { context, sourceFile } = buildFixture(
      "export function withConstraint<T extends string>(x: T): T {\n  return x;\n}\n",
    );
    const node = findFunctionTypeParam(sourceFile, "withConstraint");

    const result = traceNode(node, context);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      id: "1",
      kind: "infer",
      sourceType: "T",
      targetType: "string",
      reason: "type parameter constrained to string",
    });
  });

  it("emits no infer step for an unconstrained type parameter", () => {
    const { context, sourceFile } = buildFixture(
      "export function identity<T>(x: T): T {\n  return x;\n}\n",
    );
    const node = findFunctionTypeParam(sourceFile, "identity");

    const result = traceNode(node, context);

    expect(result.steps).toHaveLength(0);
  });

  it("emits no infer step when a type parameter is constrained by another type parameter", () => {
    const { context, sourceFile } = buildFixture(
      "export function chain<A, B extends A>(a: A, b: B): B {\n  return b;\n}\n",
    );
    const node = findFunctionTypeParam(sourceFile, "chain");

    const result = traceNode(node, context);

    expect(result.steps).toHaveLength(0);
  });
});

describe("traceNode — nested union inside conditional", () => {
  it("walks the union constituents reached through a resolved conditional branch", () => {
    const { context, sourceFile } = buildFixture(CONDITIONAL_FIXTURE);
    const checker = context.checker;

    const unionType = checker.getUnionType([
      checker.getStringType(),
      checker.getNumberType(),
    ]);
    const conditional = buildConditional(context, sourceFile, {
      resolvedTrueType: unionType,
    });

    const steps: TraceStep[] = [];
    walkType(conditional, steps, checker, createStepIdGenerator());

    expect(steps.map((s) => s.kind)).toEqual([
      "conditional",
      "conditional",
      "union",
      "union",
    ]);
    expect(steps.map((s) => s.id)).toEqual(["1", "2", "3", "4"]);
    expect(steps.slice(2).map((s) => s.targetType).sort()).toEqual(["number", "string"]);
  });
});

describe("traceNode — primitives yield zero steps", () => {
  it.each(["string", "number", "boolean"])(
    "produces no steps for a plain %s",
    (primitive) => {
      const { context, sourceFile } = buildFixture(
        `export const value: ${primitive} = ${
          primitive === "string" ? "'a'" : primitive === "number" ? "1" : "true"
        };\n`,
      );
      const node = findVariableNode(sourceFile, "value");

      const result = traceNode(node, context);

      expect(result.steps).toHaveLength(0);
      expect(result.finalType).toBe(primitive);
    },
  );
});

describe("traceNode — v0.1 emits only union/conditional/infer", () => {
  it("never emits an intersection step for an intersection type", () => {
    const { context, sourceFile } = buildFixture(
      "interface A { a: number }\ninterface B { b: string }\nexport const value: A & B = { a: 1, b: 's' };\n",
    );
    const node = findVariableNode(sourceFile, "value");
    const rootType = context.checker.getTypeAtLocation(node);

    // Confirm the fixture truly produced an intersection type, then assert the
    // walker yields zero steps rather than an "intersection" kind. Intersection
    // is out of scope for v0.1 and must never be emitted.
    expect(rootType.flags & ts.TypeFlags.Intersection).toBeTruthy();

    const result = traceNode(node, context);

    expect(result.steps).toHaveLength(0);
  });

  it("never emits a step whose kind is intersection or mapped across every supported shape", () => {
    const { context, sourceFile } = buildFixture(
      [
        "export const u: string | number = 1;",
        "export function withConstraint<T extends string>(x: T): T { return x; }",
        "type Cond<T> = T extends string ? 'yes' : 'no';",
      ].join("\n") + "\n",
    );

    const allSteps: TraceStep[] = [];
    allSteps.push(...traceNode(findVariableNode(sourceFile, "u"), context).steps);
    allSteps.push(
      ...traceNode(findFunctionTypeParam(sourceFile, "withConstraint"), context).steps,
    );

    const condType = declaredAliasType(context, sourceFile, "Cond");
    const condSteps: TraceStep[] = [];
    walkType(condType, condSteps, context.checker, createStepIdGenerator());
    allSteps.push(...condSteps);

    expect(allSteps.length).toBeGreaterThan(0);
    for (const step of allSteps) {
      expect(step.kind).not.toBe("intersection");
      expect(step.kind).not.toBe("mapped");
      expect(["union", "conditional", "infer"]).toContain(step.kind);
    }
  });
});

describe("walkType — synthesized boolean guard", () => {
  it("does not expand the true | false union that models boolean", () => {
    const { context } = buildFixture("export const x = 1;\n");
    const checker = context.checker;
    const booleanType = checker.getBooleanType();

    // The checker models boolean as a true | false union. isSynthesizedBoolean
    // must suppress expansion so no spurious "union member" steps are emitted.
    expect(booleanType.flags & ts.TypeFlags.Union).toBeTruthy();

    const steps: TraceStep[] = [];
    walkType(booleanType, steps, checker, createStepIdGenerator());

    expect(steps).toHaveLength(0);
  });

  it("still expands a genuine union that contains a boolean alongside non-boolean members", () => {
    const { context } = buildFixture("export const x = 1;\n");
    const checker = context.checker;
    const union = checker.getUnionType([checker.getStringType(), checker.getBooleanType()]);

    // string | boolean is a real, user-meaningful union: it must be expanded
    // even though one member is the synthesized boolean.
    const steps: TraceStep[] = [];
    walkType(union, steps, checker, createStepIdGenerator());

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.kind === "union")).toBe(true);
  });
});

describe("traceNode — caching", () => {
  it("returns the IDENTICAL TraceResult reference on a cache hit", () => {
    const { context, sourceFile } = buildFixture(
      "export const value: string | number = 1;\n",
    );
    const node = findVariableNode(sourceFile, "value");

    const first = traceNode(node, context);
    const second = traceNode(node, context);

    expect(second).toBe(first);
  });

  it("recomputes after clearTraceCaches() and yields a new reference", () => {
    const { context, sourceFile } = buildFixture(
      "export const value: string | number = 1;\n",
    );
    const node = findVariableNode(sourceFile, "value");

    const first = traceNode(node, context);
    clearTraceCaches();
    const second = traceNode(node, context);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it("records the resolved type in the type cache under its id", () => {
    const { context, sourceFile } = buildFixture(
      "export const value: string | number = 1;\n",
    );
    const node = findVariableNode(sourceFile, "value");
    const rootType = context.checker.getTypeAtLocation(node);
    const id = getTypeId(rootType);

    traceNode(node, context);

    expect(id).toBeDefined();
    expect(getCachedType(id as number)).toBe(rootType);
  });
});

describe("traceNode — symbol resolution", () => {
  it("falls back to node text when no symbol is present", () => {
    const { context, sourceFile } = buildFixture(
      "export const pair: [string, number] = ['a', 1];\n",
    );
    // An array-literal element has a type but no symbol at its location.
    let target: ts.Node | undefined;
    function visit(node: ts.Node): void {
      if (ts.isStringLiteral(node) && node.text === "a") {
        target = node;
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (target === undefined) {
      throw new Error("string literal element not found");
    }

    const result = traceNode(target, context);

    // No symbol at an array-literal element, so the symbol falls back to the
    // node's verbatim source text (single-quoted as authored).
    expect(result.symbol).toBe("'a'");
  });

  it("degrades to an empty symbol when the node has neither a symbol nor text", () => {
    const { context, sourceFile } = buildFixture("export const v: string = 's';\n");
    const node = findVariableNode(sourceFile, "v");
    const realType = context.checker.getTypeAtLocation(node);

    // A node with no resolvable symbol whose getText() throws (e.g. a
    // synthetic/detached node) must fall through to an empty string.
    const detached = {
      kind: ts.SyntaxKind.Identifier,
      getText(): string {
        throw new Error("detached node has no source text");
      },
    } as unknown as ts.Node;

    const checker = {
      getTypeAtLocation: () => realType,
      getSymbolAtLocation: () => undefined,
      typeToString: (t: ts.Type) => context.checker.typeToString(t),
      symbolToString: (s: ts.Symbol) => context.checker.symbolToString(s),
      getBaseConstraintOfType: (t: ts.Type) => context.checker.getBaseConstraintOfType(t),
    } as unknown as ts.TypeChecker;

    const result = traceNode(detached, { program: context.program, checker });

    expect(result.symbol).toBe("");
  });
});

describe("walkType — recursion guard", () => {
  it("does not revisit a type already on the current traversal path", () => {
    const { context, sourceFile } = buildFixture(CONDITIONAL_FIXTURE);
    const checker = context.checker;

    // Make the conditional's resolved branch point back at the conditional
    // itself, forming a cycle. The visited-set guard must stop the walk after
    // emitting the check + branch steps rather than recursing forever.
    const conditional = buildConditional(context, sourceFile, {}) as ts.Type & {
      resolvedTrueType?: ts.Type;
    };
    conditional.resolvedTrueType = conditional;

    const steps: TraceStep[] = [];
    walkType(conditional, steps, checker, createStepIdGenerator());

    expect(steps.map((s) => s.kind)).toEqual(["conditional", "conditional"]);
    expect(steps.map((s) => s.id)).toEqual(["1", "2"]);
  });
});

describe("cache module — direct helpers", () => {
  it("rememberType and getCachedType round-trip a real type", () => {
    const { context, sourceFile } = buildFixture("export const x: number = 1;\n");
    const node = findVariableNode(sourceFile, "x");
    const type = context.checker.getTypeAtLocation(node);
    const id = getTypeId(type);

    rememberType(type);

    expect(id).toBeDefined();
    expect(getCachedType(id as number)).toBe(type);
  });

  it("getCachedTrace returns the exact value stored by setCachedTrace", () => {
    const result = { symbol: "s", finalType: "number", steps: [] };
    setCachedTrace(7, result);

    expect(getCachedTrace(7)).toBe(result);
  });

  it("getTypeId returns undefined for a type object with no numeric id", () => {
    const fake = { flags: ts.TypeFlags.Number } as unknown as ts.Type;

    expect(getTypeId(fake)).toBeUndefined();
  });
});

describe("utils module", () => {
  it("createStepIdGenerator emits monotonic ids starting at '1'", () => {
    const ids = createStepIdGenerator();

    expect([ids.next(), ids.next(), ids.next()]).toEqual(["1", "2", "3"]);
  });

  it("typeToString delegates to checker.typeToString", () => {
    const { context } = buildFixture("export const x = 1;\n");
    const checker = context.checker;
    const type = checker.getNumberType();

    expect(typeToString(checker, type)).toBe(checker.typeToString(type));
  });
});
