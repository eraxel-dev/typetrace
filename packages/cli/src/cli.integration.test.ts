import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { TraceResult } from "@typetrace/shared";

/**
 * End-to-end CLI integration tests. The compiled binary (`dist/index.js`) is
 * spawned as a real child process against the on-disk fixture projects, so these
 * tests exercise the entire stack — shebang/bin wiring, commander parsing,
 * tsconfig resolution, project loading, tracing, reporting, exit codes and
 * stderr — exactly as a user would. No package internals are mocked.
 */

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const cliEntry = join(packageRoot, "dist", "index.js");
const fixturesDir = join(packageRoot, "fixtures");
const packageVersion = "0.2.0";

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd?: string): RunResult {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    encoding: "utf8",
    cwd,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function fixtureEntry(name: string): string {
  return join(fixturesDir, name, "src", "index.ts");
}

interface FixtureExpectation {
  name: string;
  symbol: string;
  finalType: string;
  stepCount: number;
  kinds: TraceResult["steps"][number]["kind"][];
}

const FIXTURES: FixtureExpectation[] = [
  {
    name: "primitive",
    symbol: "answer",
    finalType: "42",
    stepCount: 0,
    kinds: [],
  },
  {
    name: "union-type",
    symbol: "pet",
    finalType: "Cat | Dog",
    stepCount: 2,
    kinds: ["union", "union"],
  },
  {
    name: "generic-infer",
    symbol: "T",
    finalType: "T",
    stepCount: 1,
    kinds: ["infer"],
  },
  {
    name: "conditional-type",
    symbol: 'T extends string ? "yes" : "no"',
    finalType: "IsString<T>",
    stepCount: 1,
    kinds: ["conditional"],
  },
  {
    name: "nested",
    symbol: "",
    finalType: "Describe<T>",
    stepCount: 6,
    kinds: [
      "union",
      "conditional",
      "conditional",
      "union",
      "conditional",
      "conditional",
    ],
  },
];

beforeAll(() => {
  if (!existsSync(cliEntry)) {
    throw new Error(
      `CLI binary not built at ${cliEntry}. Run \`pnpm build\` before the test suite.`,
    );
  }
});

describe("cli: trace command (text output)", () => {
  for (const fixture of FIXTURES) {
    it(`traces the ${fixture.name} fixture and matches the text snapshot`, () => {
      const result = runCli(["trace", fixtureEntry(fixture.name)]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatchSnapshot();
      expect(result.stdout).toContain(`Final type: ${fixture.finalType}`);

      if (fixture.stepCount === 0) {
        expect(result.stdout).toContain("No inference steps");
      } else {
        expect(result.stdout).toContain("Step 1");
        expect(result.stdout).toContain(`Step ${fixture.stepCount}`);
      }
    });
  }
});

describe("cli: trace command (JSON output)", () => {
  for (const fixture of FIXTURES) {
    it(`emits valid TraceResult JSON for the ${fixture.name} fixture`, () => {
      const result = runCli(["trace", fixtureEntry(fixture.name), "--json"]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);

      const parsed = JSON.parse(result.stdout) as TraceResult;

      expect(typeof parsed.symbol).toBe("string");
      expect(parsed.finalType).toBe(fixture.finalType);
      expect(Array.isArray(parsed.steps)).toBe(true);
      expect(parsed.steps).toHaveLength(fixture.stepCount);
      expect(parsed.steps.map((step) => step.kind)).toEqual(fixture.kinds);
      expect(parsed.steps.map((step) => step.id)).toEqual(
        Array.from({ length: fixture.stepCount }, (_, index) => String(index + 1)),
      );
      for (const step of parsed.steps) {
        expect(typeof step.sourceType).toBe("string");
        expect(typeof step.targetType).toBe("string");
        expect(typeof step.reason).toBe("string");
      }
    });
  }

  it("matches the expected symbol for value-level fixtures", () => {
    const result = runCli(["trace", fixtureEntry("union-type"), "--json"]);
    const parsed = JSON.parse(result.stdout) as TraceResult;
    expect(parsed.symbol).toBe("pet");
  });
});

describe("cli: explain command", () => {
  it("explains the generic-infer fixture, exits 0 and matches the snapshot", () => {
    const result = runCli(["explain", fixtureEntry("generic-infer")]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatchSnapshot();
    expect(result.stdout).toContain("Final type: T");
    expect(result.stdout).toContain("Reason:");
    expect(result.stdout).toContain("was inferred as");
  });

  it("prints the plain-literal message for a fixture with no inference steps", () => {
    const result = runCli(["explain", fixtureEntry("primitive")]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No inference steps — type is a plain literal.");
    expect(result.stdout).toContain("Final type: 42");
  });

  it("exits 1 with 'Cannot locate tsconfig.json' when no tsconfig is found", () => {
    const result = runCli(["explain", "/missing.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cannot locate tsconfig.json");
    expect(result.stdout).toBe("");
  });

  it("exits 1 with 'Failed to resolve symbol' when the file has no traceable declaration", () => {
    const result = runCli(["explain", join(fixturesDir, "primitive", "tsconfig.json")]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Failed to resolve symbol");
  });
});

describe("cli: graph command", () => {
  it("writes a valid typetrace.svg for the generic-infer fixture and exits 0", () => {
    const outDir = mkdtempSync(join(tmpdir(), "typetrace-graph-"));
    try {
      const result = runCli(["graph", fixtureEntry("generic-infer")], outDir);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("Wrote typetrace.svg");

      const svgPath = join(outDir, "typetrace.svg");
      expect(existsSync(svgPath)).toBe(true);

      const svg = readFileSync(svgPath, "utf8");
      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("writes a self-contained typetrace.html with --format html", () => {
    const outDir = mkdtempSync(join(tmpdir(), "typetrace-graph-"));
    try {
      const result = runCli(
        ["graph", fixtureEntry("generic-infer"), "--format", "html"],
        outDir,
      );

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("Wrote typetrace.html");

      const htmlPath = join(outDir, "typetrace.html");
      expect(existsSync(htmlPath)).toBe(true);

      const html = readFileSync(htmlPath, "utf8");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<svg");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("writes a typetrace.mmd containing 'graph TD' with --format mermaid", () => {
    const outDir = mkdtempSync(join(tmpdir(), "typetrace-graph-"));
    try {
      const result = runCli(
        ["graph", fixtureEntry("generic-infer"), "--format", "mermaid"],
        outDir,
      );

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("Wrote typetrace.mmd");

      const mdPath = join(outDir, "typetrace.mmd");
      expect(existsSync(mdPath)).toBe(true);

      const md = readFileSync(mdPath, "utf8");
      expect(md).toContain("graph TD");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("exits 1 with the unknown-format message for an unsupported --format", () => {
    const result = runCli([
      "graph",
      fixtureEntry("generic-infer"),
      "--format",
      "bogus",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown graph format: bogus");
  });

  it("exits 1 with 'Cannot locate tsconfig.json' when no tsconfig is found", () => {
    const result = runCli(["graph", "/missing.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cannot locate tsconfig.json");
  });
});

describe("cli: error handling", () => {
  it("exits 1 with 'Cannot locate tsconfig.json' when no tsconfig is found", () => {
    const result = runCli(["trace", "/missing.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cannot locate tsconfig.json");
    expect(result.stdout).toBe("");
  });

  it("exits 1 with 'Failed to resolve symbol' when the file has no traceable declaration", () => {
    const result = runCli(["trace", join(fixturesDir, "primitive", "tsconfig.json")]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Failed to resolve symbol");
  });

  it("exits non-zero for an unknown command", () => {
    const result = runCli(["bogus"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unknown command");
  });
});

describe("cli: doctor command", () => {
  it("exits 0 and reports the TypeScript version", () => {
    const result = runCli(["doctor"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("TypeScript:");
    expect(result.stdout).toContain("tsconfig:");
    expect(result.stdout).toContain("Program:");
    expect(result.stdout).toContain("Cache:      OK");
  });
});

describe("cli: version command", () => {
  it("exits 0 and prints the package version string", () => {
    const result = runCli(["version"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(packageVersion);
    expect(result.stdout.trim()).toBe(`typetrace/${packageVersion}`);
  });
});
