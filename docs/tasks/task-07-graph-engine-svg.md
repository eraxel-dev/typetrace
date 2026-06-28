# Task 07 — Graph Engine + SVG Output + `graph` Command

## Objective

Implement `packages/graph-engine` to convert a `TraceResult` into a renderable graph structure, implement `SvgReporter` and `HtmlReporter` on top of it, and wire up the `typetrace graph <file>` CLI command that writes `typetrace.svg` to disk.

## Dependencies

- Task 01 complete (`packages/shared` types available)
- Task 03 complete (`traceNode` + `TraceResult` available)
- Task 04 complete (`Reporter` interface established)
- Task 05 complete (CLI command dispatch pattern in place)

## Scope

### `packages/graph-engine`

Convert a `TraceResult` into a directed acyclic graph of nodes and edges.

**Public API (from `spec.md`):**

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

**Mapping rules:**

- Each unique type string in `result.steps` becomes a `GraphNode`. Node `id` is the step's `id`; `label` is the type string.
- Each `TraceStep` becomes a `GraphEdge` from the node representing `step.sourceType` to the node representing `step.targetType`. Edge `label` is `step.reason`.
- If `result.steps` is empty, return a single node `{ id: "0", label: result.finalType }` and no edges.
- Deduplicate nodes by type string — if two steps share the same `sourceType`, they share the same node.

### `SvgReporter`

Add to `packages/reporters`:

```ts
// packages/reporters/src/svg.ts

class SvgReporter implements Reporter {
  render(result: TraceResult): string  // returns SVG string
}
```

**Implementation stack (from `spec.md`):**

- **[dagre](https://github.com/dagrejs/dagre)** — computes x/y positions for nodes in a DAG layout
- **[graphlib](https://github.com/dagrejs/graphlib)** — graph data structure fed to dagre
- **[svg.js](https://svgjs.dev/)** + `@svgdotjs/svg.js` with `@svgdotjs/svg-node` for server-side SVG generation

**Render algorithm:**

1. Call `buildGraph(result)` to get nodes and edges.
2. Build a `graphlib.Graph`, add nodes and edges with dagre layout options (`rankdir: "TB"`, `nodeSep: 50`, `rankSep: 70`).
3. Run `dagre.layout(g)`.
4. Use `svg.js` (node adapter) to construct an SVG:
   - One `<rect>` + `<text>` per node, positioned at the dagre-computed `x`/`y`.
   - One `<path>` per edge (straight line between node centres), with `<text>` label at midpoint.
5. Return the SVG as a string.

### `HtmlReporter`

```ts
// packages/reporters/src/html.ts

class HtmlReporter implements Reporter {
  render(result: TraceResult): string  // returns self-contained HTML
}
```

Wraps the `SvgReporter` output in a minimal HTML shell:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Typetrace — {result.symbol}</title></head>
<body>
  <!-- SvgReporter output embedded here -->
</body>
</html>
```

### Factory Update

```ts
function createReporter(format: "text" | "json" | "explain" | "svg" | "html"): Reporter
```

(The `"explain"` entry is added by Task 06; this task adds `"svg"` and `"html"`.)

### `graph` CLI Command

```sh
typetrace graph <file>
```

Output: writes `typetrace.svg` in the current working directory and prints `Wrote typetrace.svg` to stdout.

```ts
// packages/cli/src/commands/graph.ts

async function graphCommand(file: string, opts: { html?: boolean }) {
  // 1. Resolve tsconfig
  // 2. loadProject(tsconfigPath)
  // 3. Get source file; find first variable declaration node
  // 4. traceNode(node, context)
  // 5. format = opts.html ? "html" : "svg"
  // 6. createReporter(format).render(result)
  // 7. Write output to typetrace.svg (or typetrace.html if --html)
  // 8. Print "Wrote <filename>" to stdout
}
```

Register in CLI:

```ts
program
  .command("graph <file>")
  .description("Generate SVG inference graph")
  .option("--html", "Output as self-contained HTML instead of SVG")
  .action(graphCommand)
```

## Deliverables

- [ ] `packages/graph-engine/src/index.ts` — `buildGraph()` + `Graph`, `GraphNode`, `GraphEdge` types
- [ ] `packages/graph-engine/src/index.ts` re-exports public API
- [ ] `packages/graph-engine/package.json` with `dagre`, `graphlib` dependencies
- [ ] `packages/reporters/src/svg.ts` — `SvgReporter` class
- [ ] `packages/reporters/src/html.ts` — `HtmlReporter` class
- [ ] `packages/reporters/src/factory.ts` — updated to include `"svg"` and `"html"` formats
- [ ] `packages/reporters/src/index.ts` — re-exports `SvgReporter`, `HtmlReporter`
- [ ] `packages/cli/src/commands/graph.ts` — `graphCommand` handler
- [ ] `packages/cli/src/index.ts` — `graph` command registered
- [ ] Unit tests for `buildGraph`:
  - 3-step `TraceResult` produces correct node and edge counts
  - Empty steps produce single node, zero edges
  - Shared type string across steps deduplicates to one node
- [ ] Snapshot test: `SvgReporter` output for a 2-step result is a valid SVG string (contains `<svg`, `<rect`, `<path`)
- [ ] Snapshot test: `HtmlReporter` output wraps SVG in valid HTML (contains `<!DOCTYPE html>` and the SVG)
- [ ] Integration test: `typetrace graph` against `generic-infer/` fixture exits 0, writes `typetrace.svg`, file contains valid SVG
- [ ] Integration test: `typetrace graph --html` writes `typetrace.html`, file contains `<!DOCTYPE html>`

## Out of Scope

- Pixel-perfect SVG layout
- Interactive/animated SVG
- Mermaid output (Task 08)
- Watch mode
