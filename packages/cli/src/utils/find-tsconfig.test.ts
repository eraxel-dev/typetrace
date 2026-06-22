import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findTsconfig } from "./find-tsconfig.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "unravel-find-tsconfig-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("findTsconfig", () => {
  it("returns the tsconfig in the start directory itself", () => {
    const config = join(root, "tsconfig.json");
    writeFileSync(config, "{}");

    expect(findTsconfig(root)).toBe(config);
  });

  it("walks up parent directories until a tsconfig is found", () => {
    const config = join(root, "tsconfig.json");
    writeFileSync(config, "{}");
    const deep = join(root, "a", "b", "c");
    mkdirSync(deep, { recursive: true });

    expect(findTsconfig(deep)).toBe(config);
  });

  it("throws 'Cannot locate tsconfig.json' when none exists up to the root", () => {
    const deep = join(root, "x", "y");
    mkdirSync(deep, { recursive: true });

    expect(() => findTsconfig(deep)).toThrow("Cannot locate tsconfig.json");
  });
});
