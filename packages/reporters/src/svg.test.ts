import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { SvgReporter } from "./svg.js";

const twoStep: TraceResult = {
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
    {
      id: "2",
      kind: "conditional",
      sourceType: "string",
      targetType: "string & {}",
      reason: "string extends {} ? ...",
    },
  ],
};

describe("SvgReporter", () => {
  it("returns a string", () => {
    expect(typeof new SvgReporter().render(twoStep)).toBe("string");
  });

  it("produces a valid SVG containing <svg, <rect and <path", () => {
    const out = new SvgReporter().render(twoStep);
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("<path");
  });

  it("includes the type-string labels as text", () => {
    const out = new SvgReporter().render(twoStep);
    expect(out).toContain("Promise");
    expect(out).toContain("string");
  });

  it("renders an SVG even when there are no inference steps", () => {
    const empty: TraceResult = { symbol: "answer", finalType: "42", steps: [] };
    const out = new SvgReporter().render(empty);
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("42");
  });

  it("matches the snapshot", () => {
    expect(new SvgReporter().render(twoStep)).toMatchSnapshot();
  });
});
