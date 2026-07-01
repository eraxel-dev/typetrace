#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Command } from "commander";

import { doctorCommand } from "./commands/doctor.js";
import { explainCommand } from "./commands/explain.js";
import { graphCommand } from "./commands/graph.js";
import { traceCommand } from "./commands/trace.js";

export type { TraceResult } from "@typetrace/shared";

/**
 * Resolve this package's version from its `package.json`. The file is read at
 * runtime relative to the emitted module (`dist/index.js`), so the version stays
 * correct regardless of where the binary is installed and avoids baking a JSON
 * import into the ESM output.
 */
function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

const VERSION = readVersion();

/**
 * Build the commander program. Extracted so tests can construct an isolated
 * instance and drive it without touching `process.argv` or process exit.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("typetrace")
    .description("TypeScript type inference debugger")
    .version(VERSION);

  program
    .command("trace")
    .argument("<file>", "TypeScript source file to trace")
    .description("Show type inference steps")
    .option("--json", "Output as JSON")
    .action((file: string, opts: { json?: boolean }) => {
      traceCommand(file, opts);
    });

  program
    .command("explain")
    .argument("<file>", "TypeScript source file to explain")
    .description("Explain type inference in plain English")
    .action((file: string) => {
      explainCommand(file);
    });

  program
    .command("graph")
    .argument("<file>", "TypeScript source file to graph")
    .description("Generate inference graph")
    .option(
      "--format <fmt>",
      "Output format: svg | html | mermaid (default: svg)",
      "svg",
    )
    .action((file: string, opts: { format: string }) => {
      graphCommand(file, opts);
    });

  program
    .command("doctor")
    .description("Diagnose environment")
    .action(() => {
      doctorCommand();
    });

  program
    .command("version")
    .description("Print the typetrace version")
    .action(() => {
      process.stdout.write(`typetrace/${VERSION}\n`);
    });

  return program;
}

/**
 * CLI entry point. All command handlers run inside this try/catch so that any
 * thrown error (or rejected promise) is reported to stderr and the process
 * exits with code 1 — no error ever surfaces as an unhandled rejection.
 */
async function main(): Promise<void> {
  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(process.argv);
}

/**
 * Distinguish errors commander has already reported (help text, version, parse
 * failures) from genuine command failures. Commander writes its own message to
 * the appropriate stream before throwing a `CommanderError`, so re-emitting it
 * would duplicate the output; we only surface the exit code in that case.
 */
function isCommanderError(error: unknown): error is { code: string; exitCode: number } {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("commander.")
  );
}

/**
 * Run the CLI and translate any failure into a stderr message plus a non-zero
 * exit, ensuring no error escapes as an unhandled rejection. Exported so the
 * behaviour can be exercised, and so importing this module (e.g. in tests) does
 * not auto-run the program; the entry-point guard below invokes it only when
 * the module is executed directly as the binary.
 */
export function run(): Promise<void> {
  return main().catch((error: unknown) => {
    if (isCommanderError(error)) {
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

const invokedPath = process.argv[1];
const isDirectRun =
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href;

if (isDirectRun) {
  void run();
}
