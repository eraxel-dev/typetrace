import type { TraceResult } from "@typetrace/shared";

import type { Reporter } from "./types.js";

/**
 * Convert a zero-based index into a spreadsheet-style uppercase identifier
 * (`A`, `B`, …, `Z`, `AA`, `AB`, …). Used to assign stable, sequential node IDs
 * in the order unique type strings are first encountered.
 */
function nodeId(index: number): string {
  let id = "";
  let n = index;
  do {
    id = String.fromCharCode(65 + (n % 26)) + id;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return id;
}

/**
 * Format a type string as a Mermaid node label. Mermaid's flowchart syntax
 * treats `<`, `>`, `"`, `[`, `]`, `{`, `}`, `|` and `()` as structural, so any
 * label containing one of those (common in real TS types: arrays like
 * `number[]`, unions like `Cat | Dog`, object/mapped types) is wrapped in double
 * quotes, with embedded quotes escaped to the `&quot;` entity. Wrapping in
 * quotes neutralizes the remaining structural characters as well.
 */
function formatLabel(type: string): string {
  if (/[<>"[\]{}|()]/.test(type)) {
    return `"${type.replace(/"/g, "&quot;")}"`;
  }
  return type;
}

/**
 * Render a {@link TraceResult} as Mermaid `graph TD` source.
 *
 * Each unique type string across all steps is assigned a sequential uppercase
 * node ID in first-encounter order, and every {@link TraceStep} becomes one
 * `source --> target` edge line. A result with no steps degrades to a single
 * node carrying the final type. Unlike `SvgReporter`/`HtmlReporter`, this
 * reporter does not use `buildGraph`: its node-id scheme is purely sequential
 * over the raw step list.
 */
export class MermaidReporter implements Reporter {
  render(result: TraceResult): string {
    const lines = ["graph TD"];

    if (result.steps.length === 0) {
      lines.push(`  ${nodeId(0)}[${formatLabel(result.finalType)}]`);
      return lines.join("\n");
    }

    const ids = new Map<string, string>();
    const idFor = (type: string): string => {
      const existing = ids.get(type);
      if (existing !== undefined) {
        return existing;
      }
      const id = nodeId(ids.size);
      ids.set(type, id);
      return id;
    };

    for (const step of result.steps) {
      const sourceId = idFor(step.sourceType);
      const targetId = idFor(step.targetType);
      lines.push(
        `  ${sourceId}[${formatLabel(step.sourceType)}] --> ${targetId}[${formatLabel(step.targetType)}]`,
      );
    }

    return lines.join("\n");
  }
}
