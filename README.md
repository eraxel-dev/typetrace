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

## Publishing to npm

The repo contains six packages. `unravel` (the CLI) is the only one users install
directly; the `@unravel/*` packages are its transitive dependencies and must be
published alongside it.

### One-time setup

1. Create an npm account at <https://www.npmjs.com> if you don't have one.
2. Log in from the terminal:
   ```sh
   npm login
   ```
3. The `@unravel` scope must exist on npm and be linked to your account (or org).
   Create it at <https://www.npmjs.com/org/create> — use `unravel` as the org name.

### Release steps

```sh
# 1. Make sure everything builds and tests pass
pnpm install
pnpm build
pnpm test

# 2. Publish all packages in dependency order
#    pnpm automatically replaces workspace:* with the real version (^0.1.0)
pnpm publish:all
```

`pnpm publish:all` runs `pnpm -r publish --access public` which walks the
workspace in topological order (shared → engines → cli) and publishes each
package that is not marked `private`.

### Verify the release

```sh
# Smoke-test the published binary
npx unravel@0.1.0 version
# → unravel/0.1.0
```
