# Task 01 — Project Setup & Shared Types

## Objective

Bootstrap the monorepo and define all shared types used across packages. Every other task depends on this foundation being correct and complete.

## Scope

### Monorepo Structure

Initialize the following package layout:

```
packages/
  cli/
  project-loader/
  trace-engine/
  graph-engine/
  reporters/
  shared/
package.json          # root — workspaces config
tsconfig.base.json    # shared compiler options
vitest.config.ts      # shared test config
```

### Root Configuration

- **Package manager:** `pnpm` with workspaces
- **TypeScript:** `tsconfig.base.json` with `strict: true`, `moduleResolution: bundler`, `target: ES2022`
- **Testing:** Vitest
- **Linting:** ESLint with `@typescript-eslint` rules

Each package has its own `package.json` and `tsconfig.json` (extends base).

### `packages/shared`

Define all types shared across packages. This is the contract every other package depends on.

```ts
// TraceStep kinds in v0.1
type TraceStepKind = "infer" | "conditional" | "union" | "intersection" | "mapped"

interface TraceStep {
  id: string
  kind: TraceStepKind
  sourceType: string
  targetType: string
  reason: string
}

interface TraceResult {
  symbol: string
  finalType: string
  steps: TraceStep[]
}

interface GraphNode {
  id: string
  label: string
}

interface GraphEdge {
  from: string
  to: string
  label: string
}

interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface ProjectContext {
  program: ts.Program
  checker: ts.TypeChecker
}
```

All types are exported from `packages/shared/src/index.ts`.

## Deliverables

- [ ] Root `package.json` with pnpm workspaces listing all six packages
- [ ] `tsconfig.base.json` (strict, path aliases for workspace packages)
- [ ] `vitest.config.ts` at root
- [ ] `.eslintrc` with TypeScript rules
- [ ] `.gitignore` covering `node_modules`, `dist`, `*.tsbuildinfo`
- [ ] `packages/shared/` with all shared types exported
- [ ] Stub `package.json` + `tsconfig.json` for each of the five remaining packages
- [ ] `pnpm install` succeeds with no errors
- [ ] `tsc --build` succeeds with no errors across all packages

## Out of Scope

- Any implementation beyond type definitions and config
- CI/CD setup
