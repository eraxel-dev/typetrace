import * as ts from "typescript";

/**
 * Choose the AST node to trace within a source file for v0.1.
 *
 * The primary strategy mandated by the task is "the first top-level variable
 * declaration". A variable declaration always resolves to a concrete type, so
 * it is the natural target whenever the file declares one. When the file
 * declares no top-level variable (e.g. a pure type-level fixture exercising
 * conditional / infer transformations, whose types only stay deferred at a type
 * alias position), the search falls back to the first top-level type alias and
 * targets its declared type node. This keeps the common value-level case
 * targeting a variable while still allowing the CLI to trace the type-level
 * constructs that are the whole point of the tool.
 *
 * @param sourceFile - the file whose top-level declarations are scanned
 * @returns the node to pass to `traceNode`
 * @throws Error with message `"Failed to resolve symbol"` when no top-level
 *   variable or type alias declaration exists
 */
export function selectTraceNode(sourceFile: ts.SourceFile): ts.Node {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations[0];
      if (declaration !== undefined) {
        return declaration.name;
      }
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      return statement.type;
    }
  }

  throw new Error("Failed to resolve symbol");
}
