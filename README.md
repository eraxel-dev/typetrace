# unravel

Understand WHY a type became this type.

`unravel` is a TypeScript type-inference debugger. Point it at a source file and it
reconstructs the step-by-step path the TypeScript checker followed to resolve a
type — every `union`, `conditional` and `infer` transformation along the way.

## Installation

Run it directly with `npx` (no install required):

```sh
npx unravel trace src/index.ts
```

Or install it globally:

```sh
npm install -g unravel
unravel trace src/index.ts
```

## Quickstart

From any TypeScript project (one containing a `tsconfig.json`):

```sh
npx unravel trace src/index.ts
```

`unravel` walks up from the target file to locate the nearest `tsconfig.json`,
loads the project, traces the first top-level declaration, and prints the
inference steps:

```
Symbol: pet

  Step 1  Cat | Dog → Cat
          union member

  Step 2  Cat | Dog → Dog
          union member


Final type: Cat | Dog
```

Add `--json` for machine-readable output:

```sh
npx unravel trace src/index.ts --json
```

```json
{
  "symbol": "pet",
  "finalType": "Cat | Dog",
  "steps": [
    { "id": "1", "kind": "union", "sourceType": "Cat | Dog", "targetType": "Cat", "reason": "union member" },
    { "id": "2", "kind": "union", "sourceType": "Cat | Dog", "targetType": "Dog", "reason": "union member" }
  ]
}
```

## Commands

| Command | Flags | Description |
|---------|-------|-------------|
| `unravel trace <file>` | `--json` | Show the type-inference steps for the first top-level declaration in `<file>`. |
| `unravel doctor` | — | Print environment diagnostics (TypeScript version, tsconfig, program, cache). |
| `unravel version` | — | Print `unravel/<version>`. |

### `doctor`

```sh
npx unravel doctor
```

```
TypeScript: 5.7.2
tsconfig:   OK
Program:    OK
Cache:      OK
```

Each check runs in sequence; a failing check reports its error inline and the
command continues.

## Exit codes

| Condition | Exit code | Message (stderr) |
|-----------|-----------|------------------|
| Success | `0` | — |
| `tsconfig.json` not found | `1` | `Cannot locate tsconfig.json` |
| Symbol resolution failure | `1` | `Failed to resolve symbol` |
| Unknown command | `1` | commander default |

## Development

This is a pnpm workspace. Build all packages and run the test suite from the repo
root:

```sh
pnpm install
pnpm build
pnpm test
```
