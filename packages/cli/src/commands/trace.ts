import { dirname, resolve } from "node:path";

import { loadProject } from "@unravel/project-loader";
import { createReporter } from "@unravel/reporters";
import { traceNode } from "@unravel/trace-engine";

import { findTsconfig } from "../utils/find-tsconfig.js";
import { selectTraceNode } from "../utils/select-node.js";

export interface TraceOptions {
  json?: boolean;
}

/**
 * Handle `unravel trace <file>`.
 *
 * Resolves the project's `tsconfig.json` by walking up from the target file,
 * loads the program, selects the node to trace (first top-level variable
 * declaration, falling back to the first type alias), runs `traceNode`, and
 * renders the result as text (default) or JSON. The rendered output is written
 * to stdout; all error paths throw and are handled by the top-level `main`.
 *
 * @throws Error `"Cannot locate tsconfig.json"` when no config is found
 * @throws Error `"Failed to resolve symbol"` when the source file has no
 *   traceable top-level declaration or cannot be loaded into the program
 */
export function traceCommand(file: string, opts: TraceOptions): void {
  const filePath = resolve(file);
  const tsconfigPath = findTsconfig(dirname(filePath));

  const context = loadProject(tsconfigPath);

  const sourceFile = context.program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error("Failed to resolve symbol");
  }

  const node = selectTraceNode(sourceFile);
  const result = traceNode(node, context);

  const reporter = createReporter(opts.json === true ? "json" : "text");
  process.stdout.write(`${reporter.render(result)}\n`);
}
