import { statSync } from "node:fs";

import type * as ts from "typescript";

/**
 * Cache invalidation granularity
 * ------------------------------
 * Each tracked source file is fingerprinted by its modification time
 * (`mtimeMs`) AND its byte size. mtime alone is insufficient: many filesystems
 * report mtime at one-second resolution, so two edits within the same second
 * can leave the timestamp unchanged. Comparing the file size alongside mtime
 * catches the common case of a same-second edit that changes the file length,
 * at the cost of a single extra `statSync` field read (the `stat` call is
 * already being made). This is a cheap, best-effort guard — not a content
 * hash — so a same-second edit that preserves the exact byte length will still
 * be missed. Full content hashing is intentionally out of scope for v0.1.
 */

/**
 * A cached compiled program together with the fingerprints of every source
 * file that contributed to it. The fingerprints are used to decide whether a
 * cached entry is still valid on a subsequent lookup.
 *
 * `mtimes` keeps the task-required `Map<string, number>` contract (file path →
 * `mtimeMs`). A parallel `sizes` map (file path → byte size) augments it so
 * same-second edits that change the file length are detected without breaking
 * the documented `mtimes` shape.
 */
export interface CacheEntry {
  program: ts.Program;
  mtimes: Map<string, number>;
  sizes: Map<string, number>;
}

const cache = new Map<string, CacheEntry>();

interface FileFingerprint {
  mtimeMs: number;
  size: number;
}

/**
 * Read the modification time (in ms) and byte size of a file, or `undefined`
 * if it cannot be stat'd (e.g. it was deleted). Returning `undefined`
 * deliberately invalidates any cache entry that referenced the file.
 */
function readFingerprint(filePath: string): FileFingerprint | undefined {
  try {
    const stats = statSync(filePath);
    return { mtimeMs: stats.mtimeMs, size: stats.size };
  } catch {
    return undefined;
  }
}

/**
 * Build the fingerprint maps for a program by stat'ing each of its
 * non-declaration source files. Declaration files (`.d.ts`) — including the
 * standard library — are excluded because they are not part of the user's
 * authored project and would only add noise to invalidation checks.
 */
export function captureFingerprints(program: ts.Program): {
  mtimes: Map<string, number>;
  sizes: Map<string, number>;
} {
  const mtimes = new Map<string, number>();
  const sizes = new Map<string, number>();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }
    const fingerprint = readFingerprint(sourceFile.fileName);
    if (fingerprint !== undefined) {
      mtimes.set(sourceFile.fileName, fingerprint.mtimeMs);
      sizes.set(sourceFile.fileName, fingerprint.size);
    }
  }
  return { mtimes, sizes };
}

/**
 * Return a cached program for the resolved tsconfig path, but only if every
 * recorded source file still has the same mtime and byte size it had when the
 * entry was created.
 *
 * A modified file (changed mtime or size) or a removed file (no longer
 * stat-able) results in a cache miss. Files ADDED to the project after the
 * entry was built are NOT detected: invalidation only checks the files that
 * were recorded at build time, and re-globbing the project to discover new
 * files is intentionally out of scope for v0.1 (watch mode is excluded).
 */
export function getCachedProgram(resolvedTsconfigPath: string): ts.Program | undefined {
  const entry = cache.get(resolvedTsconfigPath);
  if (entry === undefined) {
    return undefined;
  }

  for (const [filePath, cachedMtime] of entry.mtimes) {
    const fingerprint = readFingerprint(filePath);
    if (
      fingerprint === undefined ||
      fingerprint.mtimeMs !== cachedMtime ||
      fingerprint.size !== entry.sizes.get(filePath)
    ) {
      cache.delete(resolvedTsconfigPath);
      return undefined;
    }
  }

  return entry.program;
}

/**
 * Store a freshly built program in the cache, capturing the current mtime and
 * byte size of each of its source files.
 */
export function setCachedProgram(resolvedTsconfigPath: string, program: ts.Program): void {
  const { mtimes, sizes } = captureFingerprints(program);
  cache.set(resolvedTsconfigPath, {
    program,
    mtimes,
    sizes,
  });
}

/**
 * Clear the entire program cache. Intended primarily for deterministic tests,
 * where a module-level cache would otherwise leak state across cases.
 */
export function clearProgramCache(): void {
  cache.clear();
}
