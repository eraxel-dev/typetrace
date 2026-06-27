import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import * as ts from "typescript";

import type { ProjectContext } from "@typetrace/shared";

import { getCachedProgram, setCachedProgram } from "./cache.js";

export type { ProjectContext } from "@typetrace/shared";
export { clearProgramCache } from "./cache.js";

/**
 * Format a list of TypeScript diagnostics into a single human-readable string,
 * using the host's newline and line/column reporting where available.
 */
function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  };
  return ts.formatDiagnostics(diagnostics, host);
}

/**
 * Load a TypeScript project from its `tsconfig.json` and construct a
 * {@link ProjectContext} exposing the program and its type checker.
 *
 * Repeat calls with the same resolved path return a cached program unless any
 * of its source files have changed on disk since it was built.
 *
 * @throws if the tsconfig cannot be located, fails to parse, or the resulting
 *   program emits fatal configuration/option diagnostics. Per-file type errors
 *   are intentionally not treated as fatal — callers (e.g. the CLI) are
 *   responsible for catching and reporting thrown errors.
 */
export function loadProject(tsconfigPath: string): ProjectContext {
  const resolvedTsconfigPath = resolve(tsconfigPath);

  if (!existsSync(resolvedTsconfigPath)) {
    throw new Error("Cannot locate tsconfig.json");
  }

  const cachedProgram = getCachedProgram(resolvedTsconfigPath);
  if (cachedProgram !== undefined) {
    return { program: cachedProgram, checker: cachedProgram.getTypeChecker() };
  }

  const readResult = ts.readConfigFile(resolvedTsconfigPath, ts.sys.readFile);
  if (readResult.error !== undefined) {
    throw new Error(formatDiagnostics([readResult.error]));
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(resolvedTsconfigPath),
    undefined,
    resolvedTsconfigPath,
  );

  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors));
  }

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });

  const fatalDiagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];

  if (fatalDiagnostics.length > 0) {
    throw new Error(formatDiagnostics(fatalDiagnostics));
  }

  setCachedProgram(resolvedTsconfigPath, program);

  return { program, checker: program.getTypeChecker() };
}
