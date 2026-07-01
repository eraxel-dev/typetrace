import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { MermaidReporter } from "./mermaid.js";

const threeStep: TraceResult = {
  symbol: "data",
  finalType: "User",
  steps: [
    {
      id: "1",
      kind: "conditional",
      sourceType: "ApiResponse",
      targetType: "ExtractData",
      reason: "ApiResponse extends ... ? ...",
    },
    {
      id: "2",
      kind: "infer",
      sourceType: "ExtractData",
      targetType: "infer U",
      reason: "infer U",
    },
    {
      id: "3",
      kind: "infer",
      sourceType: "infer U",
      targetType: "User",
      reason: "U resolved to User",
    },
  ],
};

describe("MermaidReporter", () => {
  it("returns a string starting with the graph TD header", () => {
    const out = new MermaidReporter().render(threeStep);
    expect(typeof out).toBe("string");
    expect(out.startsWith("graph TD")).toBe(true);
  });

  it("renders a three-step result with sequential node IDs", () => {
    expect(new MermaidReporter().render(threeStep)).toMatchSnapshot();
  });

  it("emits a single node with no edges for an empty step list", () => {
    const empty: TraceResult = { symbol: "answer", finalType: "42", steps: [] };
    const out = new MermaidReporter().render(empty);
    expect(out).toBe("graph TD\n  A[42]");
    expect(out).not.toContain("-->");
  });

  it("matches the snapshot for an empty step list", () => {
    const empty: TraceResult = { symbol: "answer", finalType: "42", steps: [] };
    expect(new MermaidReporter().render(empty)).toMatchSnapshot();
  });

  it("wraps labels containing angle brackets in double quotes", () => {
    const generic: TraceResult = {
      symbol: "data",
      finalType: "User",
      steps: [
        {
          id: "1",
          kind: "infer",
          sourceType: "ApiResponse<User>",
          targetType: "User",
          reason: "infer U from ApiResponse<U>",
        },
      ],
    };
    const out = new MermaidReporter().render(generic);
    expect(out).toContain('A["ApiResponse<User>"]');
    expect(out).toContain("B[User]");
  });

  it("escapes embedded double quotes to the &quot; entity", () => {
    const quoted: TraceResult = {
      symbol: "x",
      finalType: '"yes"',
      steps: [],
    };
    const out = new MermaidReporter().render(quoted);
    expect(out).toBe('graph TD\n  A["&quot;yes&quot;"]');
  });

  it("reuses the same node ID for a type shared across steps", () => {
    const shared: TraceResult = {
      symbol: "x",
      finalType: "A",
      steps: [
        {
          id: "1",
          kind: "union",
          sourceType: "A",
          targetType: "B",
          reason: "",
        },
        {
          id: "2",
          kind: "union",
          sourceType: "A",
          targetType: "C",
          reason: "",
        },
      ],
    };
    const out = new MermaidReporter().render(shared);
    const lines = out.split("\n");
    expect(lines[1]).toBe("  A[A] --> B[B]");
    expect(lines[2]).toBe("  A[A] --> C[C]");
  });

  it("matches the snapshot for shared and generic labels", () => {
    expect(new MermaidReporter().render(threeStep)).toMatchSnapshot();
  });
});
