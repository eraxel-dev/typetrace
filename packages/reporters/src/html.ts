import type { TraceResult } from "@typetrace/shared";

import { SvgReporter } from "./svg.js";
import type { Reporter } from "./types.js";

/**
 * Render a {@link TraceResult} as a self-contained HTML document that embeds the
 * {@link SvgReporter} output inline. The page needs no external assets — opening
 * the file in any browser shows the inference graph directly.
 */
export class HtmlReporter implements Reporter {
  private readonly svg = new SvgReporter();

  render(result: TraceResult): string {
    const svg = this.svg.render(result);

    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head><meta charset=\"UTF-8\"><title>Typetrace — " +
        escapeHtml(result.symbol) +
        "</title></head>",
      "<body>",
      svg,
      "</body>",
      "</html>",
    ].join("\n");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
