import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { buildGraph } from "./index.js";

function step(
  id: string,
  sourceType: string,
  targetType: string,
  reason = `reason-${id}`,
): TraceResult["steps"][number] {
  return { id, kind: "infer", sourceType, targetType, reason };
}

describe("buildGraph", () => {
  it("maps a 3-step chain to the correct node and edge counts", () => {
    const result: TraceResult = {
      symbol: "Chain",
      finalType: "D",
      steps: [step("1", "A", "B"), step("2", "B", "C"), step("3", "C", "D")],
    };

    const graph = buildGraph(result);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(graph.nodes.map((node) => node.label).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("returns a single node and zero edges for empty steps", () => {
    const result: TraceResult = {
      symbol: "answer",
      finalType: "42",
      steps: [],
    };

    const graph = buildGraph(result);

    expect(graph.nodes).toEqual([{ id: "0", label: "42" }]);
    expect(graph.edges).toEqual([]);
  });

  it("deduplicates nodes that share a type string", () => {
    const result: TraceResult = {
      symbol: "Shared",
      finalType: "string",
      steps: [
        step("1", "T", "string"),
        step("2", "T", "number"),
        step("3", "T", "boolean"),
      ],
    };

    const graph = buildGraph(result);

    // "T" is shared across all three steps -> one node, plus string/number/boolean
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    const tNodes = graph.nodes.filter((node) => node.label === "T");
    expect(tNodes).toHaveLength(1);
  });

  it("carries the step reason onto each edge label", () => {
    const result: TraceResult = {
      symbol: "Labelled",
      finalType: "B",
      steps: [step("1", "A", "B", "A becomes B")],
    };

    const graph = buildGraph(result);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.label).toBe("A becomes B");
  });

  it("connects every edge between existing nodes with unique ids", () => {
    const result: TraceResult = {
      symbol: "Branch",
      finalType: "Y",
      steps: [step("1", "A", "B"), step("2", "X", "Y")],
    };

    const graph = buildGraph(result);

    const ids = graph.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const edge of graph.edges) {
      expect(ids).toContain(edge.from);
      expect(ids).toContain(edge.to);
    }
  });
});
