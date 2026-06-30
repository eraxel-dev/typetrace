import { describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

import { HtmlReporter } from "./html.js";
import { SvgReporter } from "./svg.js";

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
    {
      id: "2",
      kind: "conditional",
      sourceType: "string",
      targetType: "string & {}",
      reason: "string extends {} ? ...",
    },
  ],
};

describe("HtmlReporter", () => {
  it("wraps the output in a valid HTML document", () => {
    const out = new HtmlReporter().render(result);
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain('<html lang="en">');
    expect(out).toContain("</html>");
  });

  it("embeds the SvgReporter output inline", () => {
    const out = new HtmlReporter().render(result);
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("<path");
  });

  it("places the symbol in the document title", () => {
    const out = new HtmlReporter().render(result);
    expect(out).toContain("<title>Typetrace — Result</title>");
  });

  it("escapes special characters in the symbol", () => {
    const escaped: TraceResult = {
      ...result,
      symbol: 'T extends "<x>" ? a : b',
    };
    const out = new HtmlReporter().render(escaped);
    expect(out).toContain("&lt;x&gt;");
    expect(out).toContain("&quot;");
    expect(out).not.toContain('<title>Typetrace — T extends "<x>"');
  });

  it("contains the full SVG produced by SvgReporter", () => {
    const out = new HtmlReporter().render(result);
    const svg = new SvgReporter().render(result);
    expect(out).toContain(svg);
  });

  it("matches the snapshot", () => {
    expect(new HtmlReporter().render(result)).toMatchSnapshot();
  });
});
