import type * as ts from "typescript";

import type { TraceResult } from "@typetrace/shared";

/**
 * In-memory caches for the trace engine.
 *
 * Both caches are module-scoped and therefore live for the lifetime of the
 * process. They are reset implicitly when the process starts and can be reset
 * explicitly with {@link clearTraceCaches} — primarily so tests stay
 * order-independent. There is no persistence to disk: each CLI invocation
 * begins with empty caches.
 *
 * Caches are keyed by `ts.Type.id`, the checker's stable per-program identifier
 * for a resolved type. Keying by id (rather than by object identity) lets us
 * deduplicate work across nodes that resolve to the same underlying type.
 */

/** Maps `ts.Type.id` to the resolved {@link ts.Type} it identifies. */
const typeCache = new Map<number, ts.Type>();

/** Maps `ts.Type.id` to the {@link TraceResult} produced for that type. */
const traceCache = new Map<number, TraceResult>();

/**
 * Read the checker-assigned numeric id for a type. `id` is an internal field on
 * `ts.Type`, so it is accessed via a narrow typed cast rather than the public
 * surface. Returns `undefined` if the checker has not assigned one.
 */
export function getTypeId(type: ts.Type): number | undefined {
  const id = (type as ts.Type & { id?: number }).id;
  return typeof id === "number" ? id : undefined;
}

/** Record a type in the type cache under its id. No-op if the type has no id. */
export function rememberType(type: ts.Type): void {
  const id = getTypeId(type);
  if (id !== undefined) {
    typeCache.set(id, type);
  }
}

/** Return the type cached under `id`, or `undefined` on a miss. */
export function getCachedType(id: number): ts.Type | undefined {
  return typeCache.get(id);
}

/**
 * Return the {@link TraceResult} cached for `id`, or `undefined` on a miss. A
 * hit returns the IDENTICAL reference that was stored, so callers can rely on
 * reference equality for deduplication.
 */
export function getCachedTrace(id: number): TraceResult | undefined {
  return traceCache.get(id);
}

/** Store a {@link TraceResult} under `id` for future cache hits. */
export function setCachedTrace(id: number, result: TraceResult): void {
  traceCache.set(id, result);
}

/**
 * Clear both the type cache and the trace cache. Intended primarily for
 * deterministic tests, where module-level caches would otherwise leak state
 * across cases.
 */
export function clearTraceCaches(): void {
  typeCache.clear();
  traceCache.clear();
}
