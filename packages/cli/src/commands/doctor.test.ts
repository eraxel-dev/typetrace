import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearProgramCache } from "@unravel/project-loader";

import { doctorCommand } from "./doctor.js";

/**
 * Unit tests for the `doctor` command. The integration suite spawns the binary
 * inside the repo (where a real tsconfig resolves), so it only exercises the
 * all-OK path. These tests drive `doctorCommand` directly with `process.cwd`
 * pointed at controlled temp directories to cover the failure branches that the
 * end-to-end run cannot reach: a missing tsconfig and a malformed tsconfig.
 */

let root: string;
let originalCwd: string;
let stdout: string;
let writeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  originalCwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), "unravel-doctor-"));
  stdout = "";
  writeSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
});

afterEach(() => {
  writeSpy.mockRestore();
  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
  clearProgramCache();
});

describe("doctorCommand", () => {
  it("always reports the active TypeScript version and an OK cache", () => {
    process.chdir(root);

    doctorCommand();

    expect(stdout).toContain(`TypeScript: ${ts.version}`);
    expect(stdout).toContain("Cache:      OK");
  });

  it("reports NOT FOUND and a program error when no tsconfig exists up-tree", () => {
    process.chdir(root);

    doctorCommand();

    expect(stdout).toContain("tsconfig:   NOT FOUND");
    expect(stdout).toContain("Program:    ERROR (no tsconfig.json)");
  });

  it("reports tsconfig OK and Program OK for a valid project", () => {
    writeFileSync(join(root, "main.ts"), "export const x = 1;\n");
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, skipLibCheck: true },
        files: ["main.ts"],
      }),
    );
    process.chdir(root);

    doctorCommand();

    expect(stdout).toContain("tsconfig:   OK");
    expect(stdout).toContain("Program:    OK");
  });

  it("reports tsconfig OK but a Program ERROR with the message for a malformed tsconfig", () => {
    writeFileSync(join(root, "tsconfig.json"), "{ this is not valid json");
    process.chdir(root);

    doctorCommand();

    expect(stdout).toContain("tsconfig:   OK");
    expect(stdout).toMatch(/Program: {4}ERROR \(.+\)/);
    // The malformed config never produces a successful program.
    expect(stdout).not.toContain("Program:    OK");
  });

  it("emits the diagnostic lines in the documented order", () => {
    process.chdir(root);

    doctorCommand();

    const lines = stdout.trimEnd().split("\n");
    expect(lines[0]?.startsWith("TypeScript:")).toBe(true);
    expect(lines[1]?.startsWith("tsconfig:")).toBe(true);
    expect(lines[2]?.startsWith("Program:")).toBe(true);
    expect(lines[3]?.startsWith("Cache:")).toBe(true);
  });
});
