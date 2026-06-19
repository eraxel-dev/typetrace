import { describe, expect, it } from "vitest";

import type { TraceResult } from "@unravel/shared";

import { TextReporter } from "./text.js";

const threeStepResult: TraceResult = {
  symbol: "Result",
  finalType: "string",
  steps: [
    {
      id: "1",
      kind: "infer",
      sourceType: "Promise<string>",
      targetType: "string",
      reason: "infer U from Promise<U>",
    },
    {
      id: "2",
      kind: "conditional",
      sourceType: "string extends number ? true : false",
      targetType: "false",
      reason: "string is not assignable to number",
    },
    {
      id: "3",
      kind: "union",
      sourceType: "false | undefined",
      targetType: "false",
      reason: "distributed over union members",
    },
  ],
};

const emptyResult: TraceResult = {
  symbol: "Literal",
  finalType: "42",
  steps: [],
};

describe("TextReporter", () => {
  it("renders a 3-step result with infer, conditional and union steps", () => {
    const output = new TextReporter().render(threeStepResult);
    expect(typeof output).toBe("string");
    expect(output).toMatchInlineSnapshot(`
      "Symbol: Result

        Step 1  Promise<string> → string
                infer U from Promise<U>

        Step 2  string extends number ? true : false → false
                string is not assignable to number

        Step 3  false | undefined → false
                distributed over union members


      Final type: string"
    `);
  });

  it("renders the plain-literal message when there are no steps", () => {
    const output = new TextReporter().render(emptyResult);
    expect(typeof output).toBe("string");
    expect(output).toMatchInlineSnapshot(`
      "Symbol: Literal

      No inference steps — type is a plain literal.

      Final type: 42"
    `);
    expect(output).toContain("No inference steps — type is a plain literal.");
  });

  it("numbers steps from 1 using step.id cast to int", () => {
    const output = new TextReporter().render(threeStepResult);
    expect(output).toContain("Step 1  ");
    expect(output).toContain("Step 2  ");
    expect(output).toContain("Step 3  ");
  });

  it("uses the U+2014 em dash in the empty-steps message", () => {
    const output = new TextReporter().render(emptyResult);
    const messageLine = output
      .split("\n")
      .find((line) => line.startsWith("No inference steps"));
    expect(messageLine).toBe("No inference steps — type is a plain literal.");
    expect(messageLine).toContain("—");
    // Guard against a regular hyphen-minus sneaking in.
    expect(messageLine).not.toContain("type is a plain literal -");
  });

  it("opens with the Symbol header followed by a blank line", () => {
    const lines = new TextReporter().render(threeStepResult).split("\n");
    expect(lines[0]).toBe("Symbol: Result");
    expect(lines[1]).toBe("");
  });

  it("closes with the Final type footer", () => {
    const lines = new TextReporter().render(threeStepResult).split("\n");
    expect(lines.at(-1)).toBe("Final type: string");
  });

  it("indents the reason aligned with the sourceType column", () => {
    const lines = new TextReporter().render(threeStepResult).split("\n");
    const headingLine = lines.find((line) => line.includes("Step 1  "));
    const reasonLine = lines.find((line) =>
      line.includes("infer U from Promise<U>"),
    );
    expect(headingLine).toBeDefined();
    expect(reasonLine).toBeDefined();

    // The reason must begin at the same column where sourceType begins on the
    // heading line, i.e. just past the "  Step N  " prefix.
    const sourceColumn = (headingLine as string).indexOf("Promise<string>");
    const reasonColumn = (reasonLine as string).search(/\S/);
    expect(reasonColumn).toBe(sourceColumn);
  });
});
