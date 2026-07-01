import { describe, expect, it } from "vitest";

import type { ReporterFormat } from "./types.js";
import { ExplainReporter } from "./explain.js";
import { HtmlReporter } from "./html.js";
import { JsonReporter } from "./json.js";
import { MermaidReporter } from "./mermaid.js";
import { SvgReporter } from "./svg.js";
import { TextReporter } from "./text.js";
import { createReporter, isReporterFormat } from "./factory.js";

describe("createReporter", () => {
  it("returns a TextReporter for \"text\"", () => {
    expect(createReporter("text")).toBeInstanceOf(TextReporter);
  });

  it("returns a JsonReporter for \"json\"", () => {
    expect(createReporter("json")).toBeInstanceOf(JsonReporter);
  });

  it("returns an ExplainReporter for \"explain\"", () => {
    expect(createReporter("explain")).toBeInstanceOf(ExplainReporter);
  });

  it("returns an SvgReporter for \"svg\"", () => {
    expect(createReporter("svg")).toBeInstanceOf(SvgReporter);
  });

  it("returns an HtmlReporter for \"html\"", () => {
    expect(createReporter("html")).toBeInstanceOf(HtmlReporter);
  });

  it("returns a MermaidReporter for \"mermaid\"", () => {
    expect(createReporter("mermaid")).toBeInstanceOf(MermaidReporter);
  });

  it("throws with the expected message for an unknown format", () => {
    expect(() =>
      createReporter("unknown" as unknown as ReporterFormat),
    ).toThrow("Unknown reporter format: unknown");
  });
});

describe("isReporterFormat", () => {
  it("accepts the supported formats", () => {
    expect(isReporterFormat("text")).toBe(true);
    expect(isReporterFormat("json")).toBe(true);
    expect(isReporterFormat("explain")).toBe(true);
    expect(isReporterFormat("svg")).toBe(true);
    expect(isReporterFormat("html")).toBe(true);
    expect(isReporterFormat("mermaid")).toBe(true);
  });

  it("rejects unsupported or non-string values", () => {
    expect(isReporterFormat("unknown")).toBe(false);
    expect(isReporterFormat(undefined)).toBe(false);
    expect(isReporterFormat(42)).toBe(false);
  });
});
