import type { TraceResult, TraceStep } from "@typetrace/shared";

import type { Reporter } from "./types.js";

const EMPTY_STEPS_MESSAGE = "No inference steps — type is a plain literal.";

/**
 * Render a {@link TraceResult} as a plain-English narrative of how a symbol's
 * final type was derived. The final type opens and closes the output, with a
 * `Reason:` block in between listing one human-readable sentence per
 * {@link TraceStep}. When there are no steps, the reason block is replaced by
 * the plain-literal message. Output is produced purely from the engine-supplied
 * `sourceType`/`targetType` strings — no type strings are constructed by hand.
 */
export class ExplainReporter implements Reporter {
  render(result: TraceResult): string {
    const lines: string[] = [result.finalType, ""];

    if (result.steps.length === 0) {
      lines.push(EMPTY_STEPS_MESSAGE);
    } else {
      lines.push("Reason:");
      for (const step of result.steps) {
        lines.push(`  ${this.describe(step)}`);
      }
    }

    lines.push("");
    lines.push(`Final type: ${result.finalType}`);

    return lines.join("\n");
  }

  private describe(step: TraceStep): string {
    switch (step.kind) {
      case "infer":
        return `${step.sourceType} was inferred as ${step.targetType}`;
      case "conditional":
        return `${step.sourceType} extends ${step.targetType} (conditional check)`;
      case "union":
        return `${step.sourceType} added ${step.targetType} via union`;
      case "intersection":
        return `${step.sourceType} intersected with ${step.targetType}`;
      case "mapped":
        return `${step.sourceType} mapped to ${step.targetType}`;
      default: {
        const exhaustiveCheck: never = step.kind;
        throw new Error(`Unknown trace step kind: ${String(exhaustiveCheck)}`);
      }
    }
  }
}
