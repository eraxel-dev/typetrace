import type { TraceResult } from "@typetrace/shared";

export type ReporterFormat = "text" | "json";

export interface Reporter {
  render(result: TraceResult): string;
}
