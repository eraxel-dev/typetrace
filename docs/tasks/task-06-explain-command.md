# Task 06 — `explain` Command

## Objective

Implement the `typetrace explain <file>` CLI command, which produces a natural-language explanation of how a symbol's final type was reached, using the `TraceResult` already produced by `trace-engine`.

## Dependencies

- Task 03 complete (`traceNode` + `TraceResult` available)
- Task 04 complete (`Reporter` interface established)
- Task 05 complete (CLI command dispatch pattern in place)

## Scope

### Command Behaviour

```sh
typetrace explain src/index.ts
```

Expected output format (from `overview.md`):

```
User | null

Reason:
  T extends ApiResponse<infer U>
  U was inferred as User
  OptionalResult added null

Final type: User | null
```

Rules:
- The first line is the final type (`result.finalType`).
- The `Reason:` block lists one bullet per `TraceStep`, rendered as a human-readable sentence (see step-to-sentence table below).
- If `result.steps` is empty, print: `No inference steps — type is a plain literal.`
- The last line is always `Final type: <result.finalType>`.

### Step-to-Sentence Mapping

| `TraceStep.kind` | Sentence template |
|------------------|-------------------|
| `"infer"` | `<step.sourceType> was inferred as <step.targetType>` |
| `"conditional"` | `<step.sourceType> extends <step.targetType> (conditional check)` |
| `"union"` | `<step.sourceType> added <step.targetType> via union` |
| `"intersection"` | `<step.sourceType> intersected with <step.targetType>` |
| `"mapped"` | `<step.sourceType> mapped to <step.targetType>` |

### `ExplainReporter`

Add a new reporter to `packages/reporters`:

```ts
// packages/reporters/src/explain.ts

class ExplainReporter implements Reporter {
  render(result: TraceResult): string
}
```

Update `createReporter` factory to accept `"explain"` as a valid format:

```ts
function createReporter(format: "text" | "json" | "explain"): Reporter
```

### CLI Integration

Add the `explain` command to `packages/cli/src/index.ts`:

```ts
program
  .command("explain <file>")
  .description("Explain type inference in plain English")
  .action(explainCommand)
```

The `explainCommand` handler follows the same file-resolution and `traceNode` call pattern as `traceCommand`. It always uses `ExplainReporter` — no `--json` flag for this command.

```ts
// packages/cli/src/commands/explain.ts

async function explainCommand(file: string) {
  // 1. Resolve tsconfig (walk up from file's directory)
  // 2. loadProject(tsconfigPath)
  // 3. Get source file; find first variable declaration node
  // 4. traceNode(node, context)
  // 5. new ExplainReporter().render(result)
  // 6. Print to stdout
}
```

Error handling is identical to `traceCommand`: exit 1 on tsconfig not found or symbol resolution failure.

## Deliverables

- [ ] `packages/reporters/src/explain.ts` — `ExplainReporter` class
- [ ] `packages/reporters/src/factory.ts` — updated to include `"explain"` format
- [ ] `packages/reporters/src/index.ts` — re-exports `ExplainReporter`
- [ ] `packages/cli/src/commands/explain.ts` — `explainCommand` handler
- [ ] `packages/cli/src/index.ts` — `explain` command registered
- [ ] Snapshot tests for `ExplainReporter`:
  - 3-step result with `infer`, `conditional`, `union` steps
  - Empty `steps` array prints the no-steps message
  - All five `kind` values render the correct sentence template
- [ ] Integration test: `typetrace explain` against the `generic-infer/` fixture exits 0 and stdout matches snapshot
- [ ] Integration test: error cases (tsconfig not found, symbol not found) exit 1 with correct stderr

## Out of Scope

- `--json` flag on `explain` (not in spec)
- AI-generated explanations
- Symbol selection by name (`--symbol` flag)
