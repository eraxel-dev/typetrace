import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { traceCommand } from "./commands/trace.js";
import { explainCommand } from "./commands/explain.js";
import { graphCommand } from "./commands/graph.js";
import { doctorCommand } from "./commands/doctor.js";
import { buildProgram } from "./index.js";

/**
 * Unit tests for the commander program wiring in `index.ts`. The integration
 * suite spawns the built binary; these tests construct an isolated program with
 * `exitOverride()` so command dispatch, option parsing, and the `version`
 * command can be asserted without touching `process.argv` or process exit, and
 * the command handlers are mocked so we test the wiring rather than the engine.
 */

vi.mock("./commands/trace.js", () => ({
  traceCommand: vi.fn(),
}));

vi.mock("./commands/explain.js", () => ({
  explainCommand: vi.fn(),
}));

vi.mock("./commands/graph.js", () => ({
  graphCommand: vi.fn(),
}));

vi.mock("./commands/doctor.js", () => ({
  doctorCommand: vi.fn(),
}));

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string };

let stdout: string;
let writeSpy: ReturnType<typeof vi.spyOn>;

function parse(program: Command, args: string[]): void {
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => {
      stdout += str;
    },
    writeErr: () => {
      /* swallow commander's own error output in unit tests */
    },
  });
  program.parse(args, { from: "user" });
}

beforeEach(() => {
  vi.clearAllMocks();
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
});

describe("buildProgram", () => {
  it("configures the program name, version and description", () => {
    const program = buildProgram();

    expect(program.name()).toBe("typetrace");
    expect(program.version()).toBe(pkg.version);
    expect(program.description()).toBe("TypeScript type inference debugger");
  });

  it("registers exactly the trace, explain, graph, doctor and version commands", () => {
    const program = buildProgram();

    const names = program.commands.map((command) => command.name()).sort();
    expect(names).toEqual(["doctor", "explain", "graph", "trace", "version"]);
  });

  it("dispatches `explain <file>` to explainCommand", () => {
    const program = buildProgram();

    parse(program, ["explain", "src/index.ts"]);

    expect(explainCommand).toHaveBeenCalledTimes(1);
    expect(explainCommand).toHaveBeenCalledWith("src/index.ts");
  });

  it("dispatches `trace <file>` to traceCommand with text output by default", () => {
    const program = buildProgram();

    parse(program, ["trace", "src/index.ts"]);

    expect(traceCommand).toHaveBeenCalledTimes(1);
    expect(traceCommand).toHaveBeenCalledWith("src/index.ts", {});
  });

  it("passes the --json flag through to traceCommand", () => {
    const program = buildProgram();

    parse(program, ["trace", "src/index.ts", "--json"]);

    expect(traceCommand).toHaveBeenCalledWith("src/index.ts", { json: true });
  });

  it("dispatches `graph <file>` to graphCommand with SVG output by default", () => {
    const program = buildProgram();

    parse(program, ["graph", "src/index.ts"]);

    expect(graphCommand).toHaveBeenCalledTimes(1);
    expect(graphCommand).toHaveBeenCalledWith("src/index.ts", { format: "svg" });
  });

  it("passes the --format flag through to graphCommand", () => {
    const program = buildProgram();

    parse(program, ["graph", "src/index.ts", "--format", "mermaid"]);

    expect(graphCommand).toHaveBeenCalledWith("src/index.ts", {
      format: "mermaid",
    });
  });

  it("dispatches `doctor` to doctorCommand", () => {
    const program = buildProgram();

    parse(program, ["doctor"]);

    expect(doctorCommand).toHaveBeenCalledTimes(1);
  });

  it("prints `typetrace/<version>` for the version command", () => {
    const program = buildProgram();

    parse(program, ["version"]);

    expect(stdout).toBe(`typetrace/${pkg.version}\n`);
  });

  it("throws a commander.* error for an unknown command", () => {
    const program = buildProgram();

    expect(() => {
      parse(program, ["bogus"]);
    }).toThrowError(
      expect.objectContaining({ code: "commander.unknownCommand" }),
    );
  });

  it("rejects `trace` without its file argument and never invokes the handler", () => {
    const program = buildProgram();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((): never => {
        throw new Error("exit");
      }) as never);

    try {
      expect(() => {
        parse(program, ["trace"]);
      }).toThrow();
    } finally {
      exitSpy.mockRestore();
    }

    expect(traceCommand).not.toHaveBeenCalled();
  });
});
