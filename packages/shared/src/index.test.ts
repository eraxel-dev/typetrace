import { describe, it, expect, expectTypeOf } from "vitest";

import type {
  TraceStepKind,
  TraceStep,
  TraceResult,
  GraphNode,
  GraphEdge,
  Graph,
  ProjectContext,
} from "./index.js";

/**
 * The shared package exports only type definitions. These tests validate the
 * type contract that every downstream package depends on:
 *  - each shape can be constructed as an object literal (compile-time check),
 *  - the literal has exactly the expected runtime keys/values, and
 *  - the declared field types match the spec via expectTypeOf.
 *
 * If any exported type is renamed, removed, or has a field altered, this file
 * fails to compile under `tsc` / Vitest's type-aware transform, which is the
 * real signal we want for a type-contract package.
 */

describe("@typetrace/shared type contract", () => {
  it("TraceStepKind admits exactly the five v0.1 kinds", () => {
    const kinds: TraceStepKind[] = [
      "infer",
      "conditional",
      "union",
      "intersection",
      "mapped",
    ];

    expect(kinds).toEqual([
      "infer",
      "conditional",
      "union",
      "intersection",
      "mapped",
    ]);
    expectTypeOf<TraceStepKind>().toEqualTypeOf<
      "infer" | "conditional" | "union" | "intersection" | "mapped"
    >();
  });

  it("TraceStep carries id, kind, sourceType, targetType, and reason", () => {
    const step: TraceStep = {
      id: "step-1",
      kind: "conditional",
      sourceType: "T extends string ? A : B",
      targetType: "A",
      reason: "T was assignable to string",
    };

    expect(step).toEqual({
      id: "step-1",
      kind: "conditional",
      sourceType: "T extends string ? A : B",
      targetType: "A",
      reason: "T was assignable to string",
    });
    expectTypeOf<TraceStep["id"]>().toEqualTypeOf<string>();
    expectTypeOf<TraceStep["kind"]>().toEqualTypeOf<TraceStepKind>();
    expectTypeOf<TraceStep["sourceType"]>().toEqualTypeOf<string>();
    expectTypeOf<TraceStep["targetType"]>().toEqualTypeOf<string>();
    expectTypeOf<TraceStep["reason"]>().toEqualTypeOf<string>();
  });

  it("TraceResult groups a symbol, finalType, and an ordered list of steps", () => {
    const step: TraceStep = {
      id: "step-1",
      kind: "infer",
      sourceType: "ReturnType<typeof f>",
      targetType: "number",
      reason: "inferred from return expression",
    };
    const result: TraceResult = {
      symbol: "result",
      finalType: "number",
      steps: [step],
    };

    expect(result.symbol).toBe("result");
    expect(result.finalType).toBe("number");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toBe(step);
    expectTypeOf<TraceResult["symbol"]>().toEqualTypeOf<string>();
    expectTypeOf<TraceResult["finalType"]>().toEqualTypeOf<string>();
    expectTypeOf<TraceResult["steps"]>().toEqualTypeOf<TraceStep[]>();
  });

  it("GraphNode has an id and a label", () => {
    const node: GraphNode = { id: "n1", label: "string" };

    expect(node).toEqual({ id: "n1", label: "string" });
    expectTypeOf<GraphNode["id"]>().toEqualTypeOf<string>();
    expectTypeOf<GraphNode["label"]>().toEqualTypeOf<string>();
  });

  it("GraphEdge connects a from node to a to node with a label", () => {
    const edge: GraphEdge = { from: "n1", to: "n2", label: "extends" };

    expect(edge).toEqual({ from: "n1", to: "n2", label: "extends" });
    expectTypeOf<GraphEdge["from"]>().toEqualTypeOf<string>();
    expectTypeOf<GraphEdge["to"]>().toEqualTypeOf<string>();
    expectTypeOf<GraphEdge["label"]>().toEqualTypeOf<string>();
  });

  it("Graph composes nodes and edges into a directed graph", () => {
    const nodes: GraphNode[] = [
      { id: "n1", label: "A" },
      { id: "n2", label: "B" },
    ];
    const edges: GraphEdge[] = [{ from: "n1", to: "n2", label: "extends" }];
    const graph: Graph = { nodes, edges };

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({ from: "n1", to: "n2", label: "extends" });
    expectTypeOf<Graph["nodes"]>().toEqualTypeOf<GraphNode[]>();
    expectTypeOf<Graph["edges"]>().toEqualTypeOf<GraphEdge[]>();
  });

  it("ProjectContext exposes a program and a checker from the TypeScript API", () => {
    // No runtime ts.Program is constructed here; the contract being asserted is
    // structural — ProjectContext must require exactly `program` and `checker`.
    expectTypeOf<ProjectContext>().toHaveProperty("program");
    expectTypeOf<ProjectContext>().toHaveProperty("checker");
    expectTypeOf<keyof ProjectContext>().toEqualTypeOf<"program" | "checker">();
  });
});
