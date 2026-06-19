import { JsonReporter } from "./json.js";
import { TextReporter } from "./text.js";
import type { Reporter, ReporterFormat } from "./types.js";

const REPORTER_FORMATS: readonly ReporterFormat[] = ["text", "json"];

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
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unknown reporter format: ${String(exhaustiveCheck)}`);
    }
  }
}
