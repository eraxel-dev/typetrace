import type { TraceResult } from "@unravel/shared";

import type { Reporter } from "./types.js";

export class JsonReporter implements Reporter {
  render(result: TraceResult): string {
    return JSON.stringify(result, null, 2);
  }
}
