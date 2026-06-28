import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProjectContext } from "@typetrace/shared";

import { clearTraceCaches } from "./cache.js";
import { traceNode } from "./index.js";

/**
 * End-to-end integration test: a real TypeScript fixture file is written to
 * disk, compiled into a genuine `ts.Program`, and traced through the public
 * {@link traceNode} entry point. The full `TraceResult` is asserted —
 * symbol, finalType and the complete ordered step list — rather than spot
 * checks, to lock the public contract against regressions.
 */

let projectDir: string;

const FIXTURE = `// Typetrace trace-engine integration fixture
export interface User {
  id: number;
  name: string;
}

// A nullable union — the canonical v0.1 transformation.
export const currentUser: User | null = null;
`;

function loadFixture(): { context: ProjectContext; sourceFile: ts.SourceFile } {
  const filePath = join(projectDir, "fixture.ts");
  writeFileSync(filePath, FIXTURE);

  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
    },
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new Error("integration fixture source file not found");
  }
  return { context: { program, checker }, sourceFile };
}

function findVariableNode(sourceFile: ts.SourceFile, name: string): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node.name;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found === undefined) {
    throw new Error(`variable '${name}' not found in integration fixture`);
  }
  return found;
}

beforeEach(() => {
  clearTraceCaches();
  projectDir = mkdtempSync(join(tmpdir(), "typetrace-trace-engine-integration-"));
});

afterEach(() => {
  clearTraceCaches();
  rmSync(projectDir, { recursive: true, force: true });
});

describe("integration: traceNode against a real fixture file", () => {
  it("produces the full expected TraceResult for a nullable union", () => {
    const { context, sourceFile } = loadFixture();
    const node = findVariableNode(sourceFile, "currentUser");

    const result = traceNode(node, context);

    expect(result.symbol).toBe("currentUser");
    expect(result.finalType).toBe("User | null");

    // The checker's union constituent ordering is not part of the public
    // contract and can shift across TS patch releases, so assert the union
    // steps as an unordered collection: exact count, every kind/sourceType/
    // reason, monotonic ids, and the multiset of targetTypes (sorted). This
    // mirrors the defensive .sort() approach used in the unit tests.
    expect(result.steps).toHaveLength(2);
    expect(result.steps.map((s) => s.id)).toEqual(["1", "2"]);
    for (const step of result.steps) {
      expect(step.kind).toBe("union");
      expect(step.sourceType).toBe("User | null");
      expect(step.reason).toBe("union member");
    }
    expect(result.steps.map((s) => s.targetType).sort()).toEqual(["User", "null"]);
  });
});
