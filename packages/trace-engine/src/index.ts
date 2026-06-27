import * as ts from "typescript";

import type { ProjectContext, TraceResult, TraceStep } from "@typetrace/shared";

import {
  getCachedTrace,
  getTypeId,
  rememberType,
  setCachedTrace,
} from "./cache.js";
import { createStepIdGenerator, typeToString } from "./utils.js";
import { walkType } from "./walker.js";

export type { TraceResult, TraceStep, TraceStepKind } from "@typetrace/shared";
export { clearTraceCaches } from "./cache.js";

/**
 * Reconstruct the step-by-step type-transformation path the TypeScript checker
 * followed to resolve the type at a given AST node.
 *
 * The node's type is resolved via the checker, then walked to emit an ordered
 * list of {@link TraceStep} records describing each `union` / `conditional` /
 * `infer` transformation encountered. Primitive (and otherwise non-transforming)
 * types yield zero steps.
 *
 * Results are memoized per process by `ts.Type.id`: tracing two nodes that
 * resolve to the same type returns the IDENTICAL {@link TraceResult} reference.
 *
 * @param node - the AST node whose resolved type should be traced
 * @param context - the loaded {@link ProjectContext} providing the checker
 * @returns the {@link TraceResult} for the node's resolved type
 */
export function traceNode(node: ts.Node, context: ProjectContext): TraceResult {
  const { checker } = context;
  const rootType = checker.getTypeAtLocation(node);

  const typeId = getTypeId(rootType);
  if (typeId !== undefined) {
    const cached = getCachedTrace(typeId);
    if (cached !== undefined) {
      return cached;
    }
  }

  rememberType(rootType);

  const symbol = resolveSymbolName(node, checker);
  const steps: TraceStep[] = [];
  walkType(rootType, steps, checker, createStepIdGenerator());

  const result: TraceResult = {
    symbol,
    finalType: typeToString(checker, rootType),
    steps,
  };

  if (typeId !== undefined) {
    setCachedTrace(typeId, result);
  }

  return result;
}

/**
 * Resolve a human-readable name for the traced node: the checker's symbol name
 * when a symbol is present, falling back to the node's source text. Both paths
 * are guarded so a missing symbol or untextable node degrades gracefully to an
 * empty string rather than throwing.
 */
function resolveSymbolName(node: ts.Node, checker: ts.TypeChecker): string {
  const symbol = checker.getSymbolAtLocation(node);
  if (symbol !== undefined) {
    return checker.symbolToString(symbol);
  }
  try {
    return node.getText();
  } catch {
    return "";
  }
}
