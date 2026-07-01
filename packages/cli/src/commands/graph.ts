import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { loadProject } from "@typetrace/project-loader";
import { createReporter, type ReporterFormat } from "@typetrace/reporters";
import { traceNode } from "@typetrace/trace-engine";

import { findTsconfig } from "../utils/find-tsconfig.js";
import { selectTraceNode } from "../utils/select-node.js";

export interface GraphOptions {
  format: string;
}

/** Output file name for each supported graph format. */
const OUTPUT_FILES = {
  svg: "typetrace.svg",
  html: "typetrace.html",
  mermaid: "typetrace.mmd",
} as const satisfies Record<string, string>;

type GraphFormat = keyof typeof OUTPUT_FILES;

function isGraphFormat(value: string): value is GraphFormat {
  return Object.prototype.hasOwnProperty.call(OUTPUT_FILES, value);
}

/**
 * Handle `typetrace graph <file>`.
 *
 * Mirrors `trace`/`explain`: resolve the project's `tsconfig.json` by walking up
 * from the target file, load the program, select the node to trace (first
 * top-level variable declaration, falling back to the first type alias), run
 * `traceNode`, then render the result in the format chosen by `--format`
 * (`svg` default, `html`, or `mermaid`). Unlike the read-only reporters, this
 * command owns the side effect: it writes the rendered output to the matching
 * file (`typetrace.svg`/`.html`/`.mmd`) in the current working directory and
 * prints `Wrote <filename>` to stdout. Unknown formats are rejected before any
 * project work; remaining error paths throw and are handled by `main`.
 *
 * @throws Error `"Cannot locate tsconfig.json"` when no config is found
 * @throws Error `"Failed to resolve symbol"` when the source file has no
 *   traceable top-level declaration or cannot be loaded into the program
 */
export function graphCommand(file: string, opts: GraphOptions): void {
  const format = opts.format;
  if (!isGraphFormat(format)) {
    process.stderr.write(`Unknown graph format: ${format}\n`);
    process.exit(1);
  }

  const filePath = resolve(file);
  const tsconfigPath = findTsconfig(dirname(filePath));

  const context = loadProject(tsconfigPath);

  const sourceFile = context.program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error("Failed to resolve symbol");
  }

  const node = selectTraceNode(sourceFile);
  const result = traceNode(node, context);

  const reporter = createReporter(format);
  const output = reporter.render(result);

  const fileName = OUTPUT_FILES[format];
  const outputPath = resolve(process.cwd(), fileName);
  writeFileSync(outputPath, output, "utf8");

  process.stdout.write(`Wrote ${fileName}\n`);
}
