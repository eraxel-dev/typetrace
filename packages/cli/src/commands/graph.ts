import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { loadProject } from "@typetrace/project-loader";
import { createReporter } from "@typetrace/reporters";
import { traceNode } from "@typetrace/trace-engine";

import { findTsconfig } from "../utils/find-tsconfig.js";
import { selectTraceNode } from "../utils/select-node.js";

export interface GraphOptions {
  html?: boolean;
}

/**
 * Handle `typetrace graph <file>`.
 *
 * Mirrors `trace`/`explain`: resolve the project's `tsconfig.json` by walking up
 * from the target file, load the program, select the node to trace (first
 * top-level variable declaration, falling back to the first type alias), run
 * `traceNode`, then render the result as SVG (default) or self-contained HTML
 * (`--html`). Unlike the read-only reporters, this command owns the side effect:
 * it writes the rendered output to `typetrace.svg` (or `typetrace.html`) in the
 * current working directory and prints `Wrote <filename>` to stdout. All error
 * paths throw and are handled by the top-level `main`.
 *
 * @throws Error `"Cannot locate tsconfig.json"` when no config is found
 * @throws Error `"Failed to resolve symbol"` when the source file has no
 *   traceable top-level declaration or cannot be loaded into the program
 */
export function graphCommand(file: string, opts: GraphOptions): void {
  const filePath = resolve(file);
  const tsconfigPath = findTsconfig(dirname(filePath));

  const context = loadProject(tsconfigPath);

  const sourceFile = context.program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error("Failed to resolve symbol");
  }

  const node = selectTraceNode(sourceFile);
  const result = traceNode(node, context);

  const format = opts.html === true ? "html" : "svg";
  const reporter = createReporter(format);
  const output = reporter.render(result);

  const fileName = opts.html === true ? "typetrace.html" : "typetrace.svg";
  const outputPath = resolve(process.cwd(), fileName);
  writeFileSync(outputPath, output, "utf8");

  process.stdout.write(`Wrote ${fileName}\n`);
}
