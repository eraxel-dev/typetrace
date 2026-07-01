import type { TraceResult } from "@typetrace/shared";

export type ReporterFormat =
  | "text"
  | "json"
  | "explain"
  | "svg"
  | "html"
  | "mermaid";

export interface Reporter {
  render(result: TraceResult): string;
}
