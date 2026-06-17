# Task 02 — Project Loader

## Objective

Implement `packages/project-loader` — the module that reads a TypeScript project's `tsconfig.json` and constructs a `ts.Program` with its `TypeChecker`. All analysis commands depend on this layer.

## Dependencies

- Task 01 complete (`packages/shared` types available)

## Scope

### Public API

```ts
// packages/project-loader/src/index.ts

function loadProject(tsconfigPath: string): ProjectContext
```

`ProjectContext` is imported from `packages/shared`.

### Behavior

1. Resolve `tsconfigPath` to an absolute path.
2. Read and parse `tsconfig.json` using `ts.readConfigFile()` and `ts.parseJsonConfigFileContent()`.
3. Call `ts.createProgram()` with the resolved file names and compiler options.
4. Return `{ program, checker: program.getTypeChecker() }`.

### Error Handling

| Condition | Thrown error / exit behavior |
|-----------|------------------------------|
| `tsconfig.json` not found | Throw `Error("Cannot locate tsconfig.json")` |
| `tsconfig.json` parse failure | Throw with TypeScript diagnostic message |
| `createProgram` emits fatal diagnostics | Throw with formatted diagnostic list |

Callers (the CLI) are responsible for catching and printing errors with exit code 1.

### Caching

Hold a module-level `Map<string, ts.Program>` keyed on the resolved `tsconfigPath`. On subsequent calls with the same path, return the cached program unless any source file's `mtime` has changed since the program was created.

```ts
interface CacheEntry {
  program: ts.Program
  mtimes: Map<string, number>  // filePath → mtime at cache time
}
```

## Deliverables

- [ ] `packages/project-loader/src/index.ts` — `loadProject()` implementation
- [ ] `packages/project-loader/src/cache.ts` — program cache with mtime invalidation
- [ ] Unit tests covering:
  - Happy path with a valid tsconfig fixture
  - Error thrown when tsconfig is missing
  - Cache hit returns same `ts.Program` reference
  - Cache miss after source file mtime changes
- [ ] `packages/project-loader/package.json` listing `typescript` as a peer dependency

## Out of Scope

- Loading multiple tsconfigs (project references)
- Watch mode
