import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { ExplainReporter } from "./explain.js";

const threeStepResult: TraceResult = {
  symbol: "result",
  finalType: "User | null",
  steps: [
    {
      id: "1",
      kind: "infer",
      sourceType: "U",
      targetType: "User",
      reason: "infer U from ApiResponse<U>",
    },
    {
      id: "2",
      kind: "conditional",
      sourceType: "T",
      targetType: "ApiResponse<infer U>",
      reason: "T is assignable to ApiResponse<infer U>",
    },
    {
      id: "3",
      kind: "union",
      sourceType: "User",
      targetType: "null",
      reason: "OptionalResult adds null",
    },
  ],
};

const emptyResult: TraceResult = {
  symbol: "Literal",
  finalType: "42",
  steps: [],
};

const allKindsResult: TraceResult = {
  symbol: "AllKinds",
  finalType: "Final",
  steps: [
    {
      id: "1",
      kind: "infer",
      sourceType: "Promise<string>",
      targetType: "string",
      reason: "infer",
    },
    {
      id: "2",
      kind: "conditional",
      sourceType: "T",
      targetType: "string",
      reason: "conditional",
    },
    {
      id: "3",
      kind: "union",
      sourceType: "A",
      targetType: "B",
      reason: "union",
    },
    {
      id: "4",
      kind: "intersection",
      sourceType: "A",
      targetType: "B",
      reason: "intersection",
    },
    {
      id: "5",
      kind: "mapped",
      sourceType: "K",
      targetType: "Mapped<K>",
      reason: "mapped",
    },
  ],
};

describe("ExplainReporter", () => {
  it("renders a 3-step result combining infer, conditional and union steps", () => {
    const output = new ExplainReporter().render(threeStepResult);
    expect(typeof output).toBe("string");
    expect(output).toMatchInlineSnapshot(`
      "User | null

      Reason:
        U was inferred as User
        T extends ApiResponse<infer U> (conditional check)
        User added null via union

      Final type: User | null"
    `);
  });

  it("renders the plain-literal message when there are no steps", () => {
    const output = new ExplainReporter().render(emptyResult);
    expect(typeof output).toBe("string");
    expect(output).toMatchInlineSnapshot(`
      "42

      No inference steps — type is a plain literal.

      Final type: 42"
    `);
    expect(output).toContain("No inference steps — type is a plain literal.");
  });

  it("renders the correct sentence template for each of the five kinds", () => {
    const output = new ExplainReporter().render(allKindsResult);
    expect(output).toMatchInlineSnapshot(`
      "Final

      Reason:
        Promise<string> was inferred as string
        T extends string (conditional check)
        A added B via union
        A intersected with B
        K mapped to Mapped<K>

      Final type: Final"
    `);
    expect(output).toContain("Promise<string> was inferred as string");
    expect(output).toContain("T extends string (conditional check)");
    expect(output).toContain("A added B via union");
    expect(output).toContain("A intersected with B");
    expect(output).toContain("K mapped to Mapped<K>");
  });

  it("opens with the final type and a blank line", () => {
    const lines = new ExplainReporter().render(threeStepResult).split("\n");
    expect(lines[0]).toBe("User | null");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("Reason:");
  });

  it("closes with the Final type footer", () => {
    const lines = new ExplainReporter().render(threeStepResult).split("\n");
    expect(lines.at(-1)).toBe("Final type: User | null");
  });

  it("indents each reason line with two spaces", () => {
    const lines = new ExplainReporter().render(threeStepResult).split("\n");
    const reasonLines = lines.filter((line) => line.startsWith("  "));
    expect(reasonLines).toHaveLength(3);
    for (const line of reasonLines) {
      expect(line).toMatch(/^ {2}\S/);
    }
  });

  it("uses the U+2014 em dash in the empty-steps message", () => {
    const output = new ExplainReporter().render(emptyResult);
    const messageLine = output
      .split("\n")
      .find((line) => line.startsWith("No inference steps"));
    expect(messageLine).toBe("No inference steps — type is a plain literal.");
    expect(messageLine).toContain("—");
    expect(messageLine).not.toContain("type is a plain literal -");
  });
});
