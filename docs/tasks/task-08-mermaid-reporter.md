# Task 08 — Mermaid Reporter + `--format` Flag

## Objective

Implement `MermaidReporter` and expose all v0.2 output formats (`svg`, `html`, `mermaid`) through a unified `--format` flag on the `graph` command, completing the full set of output formats specified in `spec.md` and `overview.md`.

## Dependencies

- Task 04 complete (`Reporter` interface established)
- Task 06 complete (`"explain"` format added to factory)
- Task 07 complete (`"svg"` and `"html"` formats added; `graph` command exists)

## Scope

### `MermaidReporter`

Add to `packages/reporters`:

```ts
// packages/reporters/src/mermaid.ts

class MermaidReporter implements Reporter {
  render(result: TraceResult): string  // returns Mermaid graph TD syntax
}
```

**Output format (from `spec.md`):**

```
graph TD
  A[ApiResponse<User>] --> B[ExtractData]
  B --> C[infer U]
  C --> D[User]
```

**Rendering rules:**

- First line is always `graph TD`.
- Each `TraceStep` maps to one edge line: `<sourceId>[<sourceType>] --> <targetId>[<targetType>]`.
- Node IDs are sequential uppercase letters (`A`, `B`, `C`, …); assign them in the order unique type strings are first encountered across all steps.
- If `result.steps` is empty, emit a single node line: `  A[<result.finalType>]` with no edges.
- Special characters in type labels that break Mermaid syntax (`<`, `>`, `"`) must be escaped by wrapping the label in `"..."`: `A["ApiResponse<User>"]`.

### Factory Update

```ts
function createReporter(
  format: "text" | "json" | "explain" | "svg" | "html" | "mermaid"
): Reporter
```

### `--format` Flag on `graph` Command

Replace the `--html` boolean flag added in Task 07 with a `--format` option that covers all graph output formats:

```ts
program
  .command("graph <file>")
  .description("Generate inference graph")
  .option(
    "--format <fmt>",
    "Output format: svg | html | mermaid (default: svg)",
    "svg"
  )
  .action(graphCommand)
```

Update `graphCommand` to branch on `opts.format`:

| `--format` | Reporter | Output file |
|------------|----------|-------------|
| `svg` (default) | `SvgReporter` | `typetrace.svg` |
| `html` | `HtmlReporter` | `typetrace.html` |
| `mermaid` | `MermaidReporter` | `typetrace.md` |

Unknown format values print `Unknown graph format: <fmt>` to stderr and exit 1.

Also update `graphCommand` signature and handler to replace the old `opts.html` boolean:

```ts
async function graphCommand(file: string, opts: { format: string }) {
  // 1. Resolve tsconfig
  // 2. loadProject(tsconfigPath)
  // 3. Get source file; find first variable declaration node
  // 4. traceNode(node, context)
  // 5. createReporter(opts.format as ...).render(result)
  // 6. Write to appropriate output file
  // 7. Print "Wrote <filename>" to stdout
}
```

## Deliverables

- [ ] `packages/reporters/src/mermaid.ts` — `MermaidReporter` class
- [ ] `packages/reporters/src/factory.ts` — updated to include `"mermaid"` format
- [ ] `packages/reporters/src/index.ts` — re-exports `MermaidReporter`
- [ ] `packages/cli/src/commands/graph.ts` — updated to use `--format` flag; removes `--html` boolean
- [ ] `packages/cli/src/index.ts` — `graph` command updated with `--format` option
- [ ] Snapshot tests for `MermaidReporter`:
  - 3-step result produces correct `graph TD` block with sequential node IDs
  - Empty steps produce single node with no edges
  - Type strings containing `<` or `>` are wrapped in quotes
  - Shared source type across steps reuses the same node ID (no duplicate node declarations)
- [ ] Unit test: `createReporter("mermaid")` returns a `MermaidReporter` instance
- [ ] Unit test: `createReporter("unknown")` still throws with the expected message
- [ ] Integration test: `typetrace graph src/index.ts --format mermaid` against `generic-infer/` fixture exits 0 and `typetrace.md` contains `graph TD`
- [ ] Integration test: `typetrace graph src/index.ts --format html` exits 0 and `typetrace.html` contains `<!DOCTYPE html>`
- [ ] Integration test: `typetrace graph src/index.ts --format unknown` exits 1 with correct stderr message

## Out of Scope

- Mermaid live preview or external rendering
- Sequence diagrams (only `graph TD` directed graph)
- `--output <file>` path override
- Watch mode
