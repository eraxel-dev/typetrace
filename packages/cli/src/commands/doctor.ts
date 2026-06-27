import * as ts from "typescript";

import { clearProgramCache, loadProject } from "@typetrace/project-loader";

import { findTsconfig } from "../utils/find-tsconfig.js";

/**
 * Handle `unravel doctor`.
 *
 * Prints an environment diagnostic table. Each check runs in sequence; a
 * failing check reports its error inline and the next check still runs, so the
 * command always exits 0 and surfaces as much information as possible:
 *
 * ```
 * TypeScript: <version>
 * tsconfig:   OK | NOT FOUND
 * Program:    OK | ERROR (<message>)
 * Cache:      OK
 * ```
 *
 * The `tsconfig` and `Program` checks are evaluated against the current working
 * directory. `Cache: OK` reports that the in-memory program cache is operative
 * and resets it so the diagnostic leaves no state behind.
 */
export function doctorCommand(): void {
  const lines: string[] = [];

  lines.push(`TypeScript: ${ts.version}`);

  let tsconfigPath: string | undefined;
  try {
    tsconfigPath = findTsconfig(process.cwd());
    lines.push(`tsconfig:   OK`);
  } catch {
    lines.push(`tsconfig:   NOT FOUND`);
  }

  if (tsconfigPath === undefined) {
    lines.push(`Program:    ERROR (no tsconfig.json)`);
  } else {
    try {
      loadProject(tsconfigPath);
      lines.push(`Program:    OK`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`Program:    ERROR (${message})`);
    }
  }

  clearProgramCache();
  lines.push(`Cache:      OK`);

  process.stdout.write(`${lines.join("\n")}\n`);
}
