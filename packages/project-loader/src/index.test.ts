import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearProgramCache, loadProject } from "./index.js";

/**
 * Each test operates on a throwaway project written to a fresh temp directory,
 * so cases never share fixtures on disk. The module-level program cache is
 * cleared before every test to keep the suite order-independent.
 */

let projectDir: string;

function writeProject(tsconfig: object, sourceFiles: Record<string, string>): string {
  const tsconfigPath = join(projectDir, "tsconfig.json");
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig));
  for (const [name, contents] of Object.entries(sourceFiles)) {
    writeFileSync(join(projectDir, name), contents);
  }
  return tsconfigPath;
}

const validTsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    strict: true,
  },
  include: ["*.ts"],
};

beforeEach(() => {
  clearProgramCache();
  projectDir = mkdtempSync(join(tmpdir(), "typetrace-project-loader-"));
});

afterEach(() => {
  clearProgramCache();
  rmSync(projectDir, { recursive: true, force: true });
});

describe("loadProject", () => {
  it("loads a valid tsconfig and returns a ProjectContext", () => {
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const answer: number = 42;\n",
    });

    const context = loadProject(tsconfigPath);

    expect(context.program).toBeDefined();
    expect(context.checker).toBeDefined();
    expect(context.checker).toBe(context.program.getTypeChecker());
    expect(typeof context.program.getSourceFiles).toBe("function");
  });

  it("throws 'Cannot locate tsconfig.json' when the tsconfig is missing", () => {
    const missingPath = join(projectDir, "does-not-exist", "tsconfig.json");

    expect(() => loadProject(missingPath)).toThrowError("Cannot locate tsconfig.json");
  });

  it("returns the same ts.Program reference on a cache hit", () => {
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const x = 1;\n",
    });

    const first = loadProject(tsconfigPath);
    const second = loadProject(tsconfigPath);

    expect(second.program).toBe(first.program);
  });

  it("rebuilds the program after a source file's mtime changes", () => {
    const sourcePath = join(projectDir, "index.ts");
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const x = 1;\n",
    });

    const first = loadProject(tsconfigPath);

    writeFileSync(sourcePath, "export const x = 2;\n");
    const future = new Date(Date.now() + 5_000);
    utimesSync(sourcePath, future, future);

    const second = loadProject(tsconfigPath);

    expect(second.program).not.toBe(first.program);
  });

  it("rebuilds the program when a same-mtime edit changes the file size", () => {
    const sourcePath = join(projectDir, "index.ts");
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const x = 1;\n",
    });

    const first = loadProject(tsconfigPath);

    // Pin the mtime to the value captured at build time, then change the file's
    // byte length. mtime-only invalidation would miss this; the size component
    // of the fingerprint must catch it.
    const pinnedMtime = statSync(sourcePath).mtime;
    writeFileSync(sourcePath, "export const x = 123456;\n");
    utimesSync(sourcePath, pinnedMtime, pinnedMtime);

    const second = loadProject(tsconfigPath);

    expect(second.program).not.toBe(first.program);
  });

  it("rebuilds the program after clearProgramCache() is called", () => {
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const x = 1;\n",
    });

    const first = loadProject(tsconfigPath);
    clearProgramCache();
    const second = loadProject(tsconfigPath);

    expect(second.program).not.toBe(first.program);
  });

  it("rebuilds the program after a tracked source file is deleted", () => {
    const tsconfigPath = writeProject(validTsconfig, {
      "index.ts": "export const x = 1;\n",
      "extra.ts": "export const y = 2;\n",
    });

    const first = loadProject(tsconfigPath);

    rmSync(join(projectDir, "extra.ts"));
    const second = loadProject(tsconfigPath);

    expect(second.program).not.toBe(first.program);
  });

  it("throws with a diagnostic message when the tsconfig fails to parse", () => {
    const tsconfigPath = join(projectDir, "tsconfig.json");
    writeFileSync(tsconfigPath, "{ this is not valid json");

    expect(() => loadProject(tsconfigPath)).toThrowError();
    expect(() => loadProject(tsconfigPath)).not.toThrowError("Cannot locate tsconfig.json");
  });

  it("throws when compiler options contain a fatal diagnostic", () => {
    // A `types` entry that resolves to no installed @types package surfaces as a
    // fatal options/global diagnostic (TS2688 "Cannot find type definition file"),
    // which loadProject treats as fatal. The exact diagnostic code/category is
    // TS-version-dependent, so we assert only that it throws rather than matching
    // a specific message.
    const tsconfigPath = writeProject(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          types: ["this-package-does-not-exist-anywhere"],
        },
        include: ["*.ts"],
      },
      { "index.ts": "export const x = 1;\n" },
    );

    expect(() => loadProject(tsconfigPath)).toThrowError();
  });
});
