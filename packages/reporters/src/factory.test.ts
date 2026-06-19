import { describe, expect, it } from "vitest";

import type { ReporterFormat } from "./types.js";
import { JsonReporter } from "./json.js";
import { TextReporter } from "./text.js";
import { createReporter, isReporterFormat } from "./factory.js";

describe("createReporter", () => {
  it("returns a TextReporter for \"text\"", () => {
    expect(createReporter("text")).toBeInstanceOf(TextReporter);
  });

  it("returns a JsonReporter for \"json\"", () => {
    expect(createReporter("json")).toBeInstanceOf(JsonReporter);
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
  });

  it("rejects unsupported or non-string values", () => {
    expect(isReporterFormat("unknown")).toBe(false);
    expect(isReporterFormat(undefined)).toBe(false);
    expect(isReporterFormat(42)).toBe(false);
  });
});
