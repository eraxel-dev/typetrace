# Task 04 — Reporters

## Objective

Implement `packages/reporters` — the output rendering layer. For v0.1, two reporters are required: plain-text and JSON. Both consume a `TraceResult` and return a `string`.

## Dependencies

- Task 01 complete (`packages/shared` types available)
- Task 03 complete (reference output for snapshot tests)

## Scope (v0.1)

### Reporter Interface

```ts
// packages/reporters/src/types.ts

interface Reporter {
  render(result: TraceResult): string
}
```

### TextReporter

Renders a human-readable step list to stdout.

**Format:**

```
Symbol: <result.symbol>

  Step 1  <step.sourceType> → <step.targetType>
          <step.reason>

  Step 2  ...

Final type: <result.finalType>
```

Rules:
- Steps are numbered starting from 1 (use `step.id` cast to int).
- `sourceType` and `targetType` are separated by ` → `.
- `reason` is indented on the line below, aligned with `sourceType`.
- If `result.steps` is empty, print: `No inference steps — type is a plain literal.`

### JsonReporter

Serializes `TraceResult` directly to JSON.

```ts
render(result: TraceResult): string {
  return JSON.stringify(result, null, 2)
}
```

Output matches the `TraceResult` shape exactly — no transformation, no extra keys.

### Reporter Selection

Export a factory:

```ts
function createReporter(format: "text" | "json"): Reporter
```

Unknown format values throw `Error("Unknown reporter format: <format>")`.

## Deliverables

- [ ] `packages/reporters/src/types.ts` — `Reporter` interface
- [ ] `packages/reporters/src/text.ts` — `TextReporter` class
- [ ] `packages/reporters/src/json.ts` — `JsonReporter` class
- [ ] `packages/reporters/src/factory.ts` — `createReporter()` factory + type guard
- [ ] `packages/reporters/src/index.ts` — re-exports all public symbols
- [ ] Snapshot tests:
  - `TextReporter` output for a 3-step `TraceResult` with `infer`, `conditional`, `union` steps
  - `TextReporter` output when `steps` is empty
  - `JsonReporter` output is valid JSON that round-trips through `JSON.parse` back to the original `TraceResult`
- [ ] Unit test: `createReporter("unknown")` throws with the expected message

## Out of Scope

- `SvgReporter`, `HtmlReporter`, `MermaidReporter` (v0.2+)
- Color/ANSI terminal formatting
- Streaming output
