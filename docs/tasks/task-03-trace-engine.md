# Task 03 — Trace Engine

## Objective

Implement `packages/trace-engine` — the core of Typetrace. Given an AST node, it reconstructs the step-by-step type transformation path that TypeScript's checker followed to arrive at the final type.

This is the most critical and complex module in the project.

## Dependencies

- Task 01 complete (`packages/shared` types available)
- Task 02 complete (`ProjectContext` available for test fixtures)

## Scope (v0.1)

v0.1 must handle three type transformation kinds:

| Kind | `TypeFlags` | Example |
|------|-------------|---------|
| `"infer"` | `TypeFlags.TypeParameter` with constraint | `infer U in T extends Foo<infer U>` |
| `"conditional"` | `TypeFlags.Conditional` | `T extends A ? B : C` |
| `"union"` | `TypeFlags.Union` | `User \| null` |

Intersection and mapped types are **not** required for v0.1.

### Public API

```ts
// packages/trace-engine/src/index.ts

function traceNode(node: ts.Node, context: ProjectContext): TraceResult
```

`TraceResult` and `TraceStep` are imported from `packages/shared`.

### Algorithm

```
traceNode(node, context)
  1. Call checker.getTypeAtLocation(node) → rootType
  2. Set symbol = checker.symbolToString(checker.getSymbolAtLocation(node)) or node text
  3. Call walkType(rootType, steps=[])
  4. Return { symbol, finalType: typeToString(rootType), steps }

walkType(type, steps)
  if type.flags & TypeFlags.Union:
    for each constituent in (type as UnionType).types:
      push TraceStep { kind:"union", sourceType: typeToString(type), targetType: typeToString(constituent), reason: "union member" }
      walkType(constituent, steps)

  if type.flags & TypeFlags.Conditional:
    ct = type as ConditionalType
    push TraceStep { kind:"conditional", sourceType: typeToString(ct.checkType), targetType: typeToString(ct.extendsType), reason: "conditional check" }
    push TraceStep for true/false branch based on resolved type
    walkType(resolved branch, steps)

  if type.flags & TypeFlags.TypeParameter:
    if type has inferred instantiation:
      push TraceStep { kind:"infer", sourceType: typeToString(type), targetType: typeToString(instantiated), reason: "type parameter inferred as ..." }
      walkType(instantiated, steps)
```

Each `TraceStep.id` is a monotonically incrementing integer stringified (`"1"`, `"2"`, …).

### Caching

Two in-memory caches per process invocation:

```ts
const typeCache  = new Map<number, ts.Type>()       // ts.Type.id → ts.Type
const traceCache = new Map<number, TraceResult>()   // ts.Type.id → TraceResult
```

Invalidated between CLI invocations (no persistence — caches live in module scope, reset on process start).

### Type-to-String Utility

Use `checker.typeToString(type)` as the canonical stringification throughout. Do not construct type strings manually.

## Deliverables

- [ ] `packages/trace-engine/src/index.ts` — `traceNode()` entry point
- [ ] `packages/trace-engine/src/walker.ts` — recursive `walkType()` logic
- [ ] `packages/trace-engine/src/cache.ts` — type + trace caches
- [ ] `packages/trace-engine/src/utils.ts` — shared helpers (step ID generator, typeToString wrapper)
- [ ] Unit tests achieving **≥ 95% line coverage**:
  - Each step kind (`infer`, `conditional`, `union`) tested in isolation with minimal TS AST fixtures
  - Nested union inside conditional
  - No steps when type is a plain primitive (string, number, boolean)
  - Cache hit returns same `TraceResult` reference
- [ ] Integration test: run `traceNode` against a real TypeScript fixture file and assert full `TraceResult` output

## Out of Scope

- `intersection`, `mapped` step kinds (v0.2+)
- Template literal types
- Recursive/self-referential types
