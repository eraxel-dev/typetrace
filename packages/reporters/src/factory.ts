import { ExplainReporter } from "./explain.js";
import { HtmlReporter } from "./html.js";
import { JsonReporter } from "./json.js";
import { SvgReporter } from "./svg.js";
import { TextReporter } from "./text.js";
import type { Reporter, ReporterFormat } from "./types.js";

const REPORTER_FORMATS: readonly ReporterFormat[] = [
  "text",
  "json",
  "explain",
  "svg",
  "html",
];

export function isReporterFormat(value: unknown): value is ReporterFormat {
  return (
    typeof value === "string" &&
    (REPORTER_FORMATS as readonly string[]).includes(value)
  );
}

export function createReporter(format: ReporterFormat): Reporter {
  switch (format) {
    case "text":
      return new TextReporter();
    case "json":
      return new JsonReporter();
    case "explain":
      return new ExplainReporter();
    case "svg":
      return new SvgReporter();
    case "html":
      return new HtmlReporter();
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unknown reporter format: ${String(exhaustiveCheck)}`);
    }
  }
}
