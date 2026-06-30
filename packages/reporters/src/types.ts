import type { TraceResult } from "@typetrace/shared";

export type ReporterFormat = "text" | "json" | "explain" | "svg" | "html";

export interface Reporter {
  render(result: TraceResult): string;
}
