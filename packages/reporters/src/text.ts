import type { TraceResult, TraceStep } from "@typetrace/shared";

import type { Reporter } from "./types.js";

const EMPTY_STEPS_MESSAGE = "No inference steps — type is a plain literal.";

export class TextReporter implements Reporter {
  render(result: TraceResult): string {
    const lines: string[] = [`Symbol: ${result.symbol}`, ""];

    if (result.steps.length === 0) {
      lines.push(EMPTY_STEPS_MESSAGE);
    } else {
      for (const step of result.steps) {
        const heading = `  Step ${Number(step.id)}  `;
        const reasonIndent = " ".repeat(heading.length);
        lines.push(`${heading}${this.formatTransition(step)}`);
        lines.push(`${reasonIndent}${step.reason}`);
        lines.push("");
      }
    }

    lines.push("");
    lines.push(`Final type: ${result.finalType}`);

    return lines.join("\n");
  }

  private formatTransition(step: TraceStep): string {
    return `${step.sourceType} → ${step.targetType}`;
  }
}
