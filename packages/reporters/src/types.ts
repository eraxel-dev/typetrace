import type { TraceResult } from "@unravel/shared";

export type ReporterFormat = "text" | "json";

export interface Reporter {
  render(result: TraceResult): string;
}
