import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { JsonReporter } from "./json.js";

const result: TraceResult = {
  symbol: "Result",
  finalType: "string",
  steps: [
    {
      id: "1",
      kind: "infer",
      sourceType: "Promise<string>",
      targetType: "string",
      reason: "infer U from Promise<U>",
    },
  ],
};

describe("JsonReporter", () => {
  it("returns a string", () => {
    expect(typeof new JsonReporter().render(result)).toBe("string");
  });

  it("equals JSON.stringify(result, null, 2)", () => {
    expect(new JsonReporter().render(result)).toBe(
      JSON.stringify(result, null, 2),
    );
  });

  it("round-trips through JSON.parse back to the original TraceResult", () => {
    const output = new JsonReporter().render(result);
    const parsed = JSON.parse(output) as TraceResult;
    expect(parsed).toEqual(result);
  });

  it("adds no extra keys and applies no transformation", () => {
    const parsed = JSON.parse(new JsonReporter().render(result)) as TraceResult;
    expect(Object.keys(parsed).sort()).toEqual([
      "finalType",
      "steps",
      "symbol",
    ]);
  });

  it("round-trips a multi-step result covering every step kind", () => {
    const fullResult: TraceResult = {
      symbol: "Complex",
      finalType: "{ a: 1 }",
      steps: [
        {
          id: "1",
          kind: "infer",
          sourceType: "Promise<string>",
          targetType: "string",
          reason: "infer U from Promise<U>",
        },
        {
          id: "2",
          kind: "conditional",
          sourceType: "A extends B ? C : D",
          targetType: "C",
          reason: "A is assignable to B",
        },
        {
          id: "3",
          kind: "union",
          sourceType: "A | B",
          targetType: "A",
          reason: "distributed over union",
        },
        {
          id: "4",
          kind: "intersection",
          sourceType: "A & B",
          targetType: "A & B",
          reason: "merged members",
        },
        {
          id: "5",
          kind: "mapped",
          sourceType: "{ [K in keyof T]: T[K] }",
          targetType: "{ a: 1 }",
          reason: "mapped over keys of T",
        },
      ],
    };

    const parsed = JSON.parse(
      new JsonReporter().render(fullResult),
    ) as TraceResult;
    expect(parsed).toEqual(fullResult);
    expect(parsed.steps).toHaveLength(5);
    expect(parsed.steps.map((s) => s.kind)).toEqual([
      "infer",
      "conditional",
      "union",
      "intersection",
      "mapped",
    ]);
  });

  it("emits 2-space indented JSON", () => {
    const output = new JsonReporter().render(result);
    expect(output).toContain('\n  "symbol":');
  });
});
