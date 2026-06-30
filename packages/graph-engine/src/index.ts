import type { Graph, GraphEdge, GraphNode, TraceResult } from "@typetrace/shared";

export type { Graph, GraphEdge, GraphNode } from "@typetrace/shared";

/**
 * Convert a {@link TraceResult} into a directed acyclic graph of type nodes and
 * inference edges.
 *
 * Mapping rules:
 * - Every distinct type string appearing as a `sourceType` or `targetType`
 *   across `result.steps` becomes exactly one {@link GraphNode}. Deduplication
 *   is keyed on the type string, so two steps that share a type collapse onto a
 *   single node.
 * - Every {@link TraceResult["steps"]} entry becomes one {@link GraphEdge} from
 *   its `sourceType` node to its `targetType` node, labelled with `step.reason`.
 * - When `result.steps` is empty, the graph is a single node
 *   `{ id: "0", label: result.finalType }` with no edges.
 *
 * Node ids: a node's id is the `id` of the first step in which its type string
 * appears, scanning `sourceType` before `targetType` within each step. The first
 * type string to claim a given step id keeps it ("first-seen wins"); when a
 * later distinct type would collide on that id (e.g. a step whose `sourceType`
 * and `targetType` are both new), it receives a deterministic suffixed id so
 * that every node id stays unique and edges resolve unambiguously.
 */
export function buildGraph(result: TraceResult): Graph {
  if (result.steps.length === 0) {
    return { nodes: [{ id: "0", label: result.finalType }], edges: [] };
  }

  const idByType = new Map<string, string>();
  const usedIds = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const ensureNode = (typeString: string, preferredId: string): string => {
    const existing = idByType.get(typeString);
    if (existing !== undefined) {
      return existing;
    }

    let id = preferredId;
    let collision = 2;
    while (usedIds.has(id)) {
      id = `${preferredId}:${String(collision)}`;
      collision += 1;
    }

    usedIds.add(id);
    idByType.set(typeString, id);
    nodes.push({ id, label: typeString });
    return id;
  };

  for (const step of result.steps) {
    const from = ensureNode(step.sourceType, step.id);
    const to = ensureNode(step.targetType, step.id);
    edges.push({ from, to, label: step.reason });
  }

  return { nodes, edges };
}
