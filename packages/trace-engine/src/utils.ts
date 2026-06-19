import type * as ts from "typescript";

/**
 * A monotonic step-ID generator. Each call to {@link next} returns the next
 * integer in sequence as a string, starting at `"1"`. A fresh generator is
 * created per {@link traceNode} invocation so that step IDs within a single
 * {@link TraceResult} always begin at `"1"` and increase by one.
 */
export interface StepIdGenerator {
  /** Return the next id in sequence, stringified (`"1"`, `"2"`, …). */
  next(): string;
}

/**
 * Create a {@link StepIdGenerator} whose first emitted id is `"1"`.
 */
export function createStepIdGenerator(): StepIdGenerator {
  let counter = 0;
  return {
    next(): string {
      counter += 1;
      return String(counter);
    },
  };
}

/**
 * Canonical type stringification for the trace engine. This is a thin wrapper
 * around `checker.typeToString` so that every emitted `sourceType` / `targetType`
 * / `finalType` value is produced the same way. Type strings are NEVER built
 * manually — always route through this helper.
 */
export function typeToString(checker: ts.TypeChecker, type: ts.Type): string {
  return checker.typeToString(type);
}
