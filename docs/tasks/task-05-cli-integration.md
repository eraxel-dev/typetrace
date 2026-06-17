# Task 05 — CLI & Integration

## Objective

Implement `packages/cli` — the entry point users invoke. Wire all packages together, implement the `trace`, `doctor`, and `version` commands, and validate the full end-to-end flow with integration tests against real TypeScript fixture projects.

## Dependencies

- Task 01 complete (monorepo structure)
- Task 02 complete (`loadProject`)
- Task 03 complete (`traceNode`)
- Task 04 complete (`createReporter`)

## Scope

### CLI Commands (v0.1)

| Command | Flags | Behavior |
|---------|-------|----------|
| `unravel trace <file>` | `--json` | Run `traceNode`, render with `TextReporter` (default) or `JsonReporter` |
| `unravel doctor` | — | Print environment diagnostics |
| `unravel version` | — | Print `unravel/<version>` |

`explain` and `graph` commands are **not** in v0.1.

### Implementation

Use `commander` for argument parsing.

```ts
// packages/cli/src/index.ts — entry point

#!/usr/bin/env node
import { Command } from "commander"

const program = new Command()
  .name("unravel")
  .description("TypeScript type inference debugger")
  .version(VERSION)

program
  .command("trace <file>")
  .description("Show type inference steps")
  .option("--json", "Output as JSON")
  .action(traceCommand)

program
  .command("doctor")
  .description("Diagnose environment")
  .action(doctorCommand)

program.parse()
```

### `trace` Command

```ts
async function traceCommand(file: string, opts: { json?: boolean }) {
  // 1. Resolve tsconfig (walk up from file's directory)
  // 2. loadProject(tsconfigPath)
  // 3. Get the source file from program; find the first variable declaration node
  // 4. traceNode(node, context)
  // 5. createReporter(opts.json ? "json" : "text").render(result)
  // 6. Print to stdout
}
```

**Symbol resolution:** For v0.1, target the first top-level variable declaration in the given file. This keeps the scope simple without requiring cursor position input.

**tsconfig resolution:** Walk up from the given file's directory until `tsconfig.json` is found, or throw `"Cannot locate tsconfig.json"`.

### `doctor` Command

Print a diagnostic table:

```
TypeScript: <ts.version>
tsconfig:   OK | NOT FOUND
Program:    OK | ERROR (<message>)
Cache:      OK
```

Each check runs in sequence; failures print the error inline and continue.

### Error Handling

| Condition | stderr message | Exit code |
|-----------|---------------|-----------|
| `tsconfig.json` not found | `Cannot locate tsconfig.json` | 1 |
| Symbol resolution failure | `Failed to resolve symbol` | 1 |
| Unknown command | `commander` default | 1 |

All errors are caught at the top-level `main()` try/catch; never let unhandled rejections reach the process.

### Binary

- `packages/cli/package.json` sets `"bin": { "unravel": "dist/index.js" }`
- Add shebang `#!/usr/bin/env node` at top of entry file
- `pnpm build` compiles to `dist/` via `tsc`

## Integration Tests

Create fixture TypeScript projects under `packages/cli/fixtures/`:

| Fixture | Type pattern | Expected steps |
|---------|-------------|----------------|
| `generic-infer/` | `T extends Foo<infer U>` | 1 `infer` step |
| `union-type/` | `A \| B \| C` | 2 `union` steps |
| `conditional-type/` | `T extends string ? A : B` | 1 `conditional` step |
| `nested/` | conditional wrapping a union | 3+ steps |
| `primitive/` | `const x = 42` | 0 steps |

Each fixture has a `src/index.ts` that the CLI targets.

For each fixture, assert:
- `unravel trace src/index.ts` exits 0 and stdout matches snapshot
- `unravel trace src/index.ts --json` exits 0 and stdout is valid JSON matching `TraceResult` shape

Also assert:
- `unravel trace missing.ts` exits 1 with `Cannot locate tsconfig.json` on stderr
- `unravel doctor` exits 0 and stdout contains `TypeScript:` line
- `unravel version` exits 0 and stdout contains the package version string

## Deliverables

- [ ] `packages/cli/src/index.ts` — main entry with commander setup
- [ ] `packages/cli/src/commands/trace.ts` — trace command handler
- [ ] `packages/cli/src/commands/doctor.ts` — doctor command handler
- [ ] `packages/cli/src/utils/find-tsconfig.ts` — walk-up tsconfig finder
- [ ] `packages/cli/fixtures/` — five fixture projects (each with `tsconfig.json` + `src/index.ts`)
- [ ] Integration tests for all fixtures and error cases (listed above)
- [ ] `packages/cli/package.json` with `bin` field and `commander` dependency
- [ ] Root `README.md` with installation and quickstart (`npx unravel trace`)

## Out of Scope

- `explain` command (v0.2+)
- `graph` command (v0.2+)
- `--symbol` flag for targeting a specific symbol by name
- Watch mode
- Published npm package / CI release pipeline
