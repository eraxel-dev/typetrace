import { dirname, resolve } from "node:path";

import { loadProject } from "@typetrace/project-loader";
import { ExplainReporter } from "@typetrace/reporters";
import { traceNode } from "@typetrace/trace-engine";

import { findTsconfig } from "../utils/find-tsconfig.js";
import { selectTraceNode } from "../utils/select-node.js";

/**
 * Handle `typetrace explain <file>`.
 *
 * Resolves the project's `tsconfig.json` by walking up from the target file,
 * loads the program, selects the node to trace (first top-level variable
 * declaration, falling back to the first type alias), runs `traceNode`, and
 * renders the result as a plain-English explanation. The rendered output is
 * written to stdout; all error paths throw and are handled by the top-level
 * `main`. Unlike `trace`, this command always uses `ExplainReporter` and has no
 * `--json` flag.
 *
 * @throws Error `"Cannot locate tsconfig.json"` when no config is found
 * @throws Error `"Failed to resolve symbol"` when the source file has no
 *   traceable top-level declaration or cannot be loaded into the program
 */
export function explainCommand(file: string): void {
  const filePath = resolve(file);
  const tsconfigPath = findTsconfig(dirname(filePath));

  const context = loadProject(tsconfigPath);

  const sourceFile = context.program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error("Failed to resolve symbol");
  }

  const node = selectTraceNode(sourceFile);
  const result = traceNode(node, context);

  const reporter = new ExplainReporter();
  process.stdout.write(`${reporter.render(result)}\n`);
}
