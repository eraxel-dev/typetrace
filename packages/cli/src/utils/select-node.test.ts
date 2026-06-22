import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import { selectTraceNode } from "./select-node.js";

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile("test.ts", source, ts.ScriptTarget.ES2022, true);
}

describe("selectTraceNode", () => {
  it("selects the first top-level variable declaration name", () => {
    const sf = parse("const first = 1;\nconst second = 2;\n");
    const node = selectTraceNode(sf);

    expect(ts.isIdentifier(node)).toBe(true);
    expect((node as ts.Identifier).text).toBe("first");
  });

  it("prefers a variable declaration even when a type alias appears first", () => {
    const sf = parse("type Alias = string;\nconst value = 1;\n");
    const node = selectTraceNode(sf);

    expect(ts.isIdentifier(node)).toBe(true);
    expect((node as ts.Identifier).text).toBe("value");
  });

  it("falls back to the first type alias's type node when no variable exists", () => {
    const sf = parse("type Cond<T> = T extends string ? 1 : 2;\n");
    const node = selectTraceNode(sf);

    expect(ts.isConditionalTypeNode(node)).toBe(true);
  });

  it("throws 'Failed to resolve symbol' when no traceable declaration exists", () => {
    const sf = parse("export function noop() {}\n");

    expect(() => selectTraceNode(sf)).toThrow("Failed to resolve symbol");
  });
});
