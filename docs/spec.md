# Typetrace — Technical Design

Version 1.0

---

## Architecture

```
CLI
  │  parse args, dispatch command
  ▼
Project Loader
  │  load tsconfig, build ts.Program
  ▼
TypeScript Program
  │  ts.TypeChecker
  ▼
Type Extraction
  │  resolve symbol → ts.Type
  ▼
Trace Engine
  │  walk type transformations → TraceResult
  ▼
Graph Builder
  │  TraceResult → nodes + edges
  ▼
Reporter
     text | json | svg | html | mermaid
```

---

## Package Structure

```
packages/
  cli/             # Argument parsing, command dispatch
  project-loader/  # tsconfig parsing, Program creation
  trace-engine/    # Core type-walk logic (most critical)
  graph-engine/    # TraceResult → GraphNode/GraphEdge
  reporters/       # Output renderers (text, json, svg, html, mermaid)
  shared/          # Types shared across packages
```

---

## Module Specs

### `cli`

**Responsibilities:**
- Parse CLI arguments
- Dispatch to the correct command handler
- Call the appropriate Reporter

**Dependencies:** `commander`

---

### `project-loader`

**Responsibilities:**
- Parse `tsconfig.json`
- Create `ts.Program` via `createProgram()`

**Exports:**

```ts
interface ProjectContext {
  program: ts.Program
  checker: ts.TypeChecker
}

function loadProject(tsconfigPath: string): ProjectContext
```

---

### `trace-engine`

**The most critical module.**

**Responsibility:** Build the type transformation history for a given AST node.

**Input:** `ts.Node`

**Output:** `TraceResult`

**Core types:**

```ts
interface TraceStep {
  id: string
  kind: "infer" | "conditional" | "union" | "intersection" | "mapped"
  sourceType: string
  targetType: string
  reason: string
}

interface TraceResult {
  symbol: string
  finalType: string
  steps: TraceStep[]
}
```

**Implementation notes:**
- Use `TypeChecker.getTypeAtLocation()` as the entry point
- Recurse into `ts.Type` flags (`TypeFlags.Conditional`, `TypeFlags.Union`, etc.) to reconstruct steps
- Each step must record `sourceType → targetType` with a human-readable `reason`

---

### `graph-engine`

**Responsibility:** Convert a `TraceResult` into a graph structure suitable for rendering.

```ts
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

function buildGraph(result: TraceResult): Graph
```

---

### `reporters`

Each reporter implements a common interface:

```ts
interface Reporter {
  render(result: TraceResult): string
}
```

| Reporter | Output |
|----------|--------|
| `TextReporter` | Plain-text step list |
| `JsonReporter` | JSON serialization of `TraceResult` |
| `SvgReporter` | DAG SVG via dagre + svg.js |
| `HtmlReporter` | Self-contained HTML with embedded SVG |
| `MermaidReporter` | Mermaid `graph TD` syntax |

**MermaidReporter example output:**
```
graph TD
  A[ApiResponse<User>] --> B[ExtractData]
  B --> C[infer U]
  C --> D[User]
```

---

## Caching

Three-layer cache to avoid redundant recomputation:

| Cache | Key | Value |
|-------|-----|-------|
| Program Cache | `tsconfig path` | `ts.Program` |
| Type Cache | `NodeId` | `ts.Type` |
| Trace Cache | `NodeId` | `TraceResult` |

All caches are `Map<string, T>` held in memory per invocation. Invalidated when source files change (compare mtime).

---

## SVG Generation

Use the following stack:

- **[dagre](https://github.com/dagrejs/dagre)** — DAG layout
- **[graphlib](https://github.com/dagrejs/graphlib)** — graph data structure
- **[svg.js](https://svgjs.dev/)** — SVG element construction

---

## Testing Strategy

### Unit tests — `trace-engine`

- Target: **95% coverage**
- Test each `TraceStep` kind in isolation with minimal TypeScript AST fixtures

### Integration tests — Fixture projects

- Maintain **100+ fixture TypeScript projects** covering real-world type patterns
- Assert full `TraceResult` output per fixture

### Snapshot tests

- CLI text output
- JSON output
- SVG output (structure, not pixel-perfect)

---

## Release Plan

| Version | Scope |
|---------|-------|
| v0.1 | Generic, Union, Conditional type tracing |
| v0.2 | SVG output, Mermaid output, `explain` command |
| v0.3 | Compiler hook integration |
| v1.0 | Full inference debugger — feature complete |
