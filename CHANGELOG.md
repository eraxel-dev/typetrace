# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-07-01

### Added

- **Mermaid reporter** (`--format mermaid`) — renders the type inference graph as Mermaid `graph TD` syntax and writes `typetrace.mmd`. Node IDs are assigned sequentially (A, B, … Z, AA, …); labels containing structural Mermaid characters (`<>`, `[]`, `{}`, `|`, `()`) are automatically quoted and embedded double-quotes are escaped to `&quot;`.
- **`graph --format` flag** — replaces the old `--html` boolean with a string option (`svg` | `html` | `mermaid`, default `svg`), making the graph command extensible to future output formats without additional flags.
- **`explain` command** — `typetrace explain <file>` produces a plain-English narrative of the type inference steps for the first traceable top-level declaration in the file.
- **SVG/HTML graph output** — `typetrace graph <file>` generates a DAG layout using dagre + svg.js. Pass `--format html` for a self-contained HTML file with the SVG embedded.

### Changed

- `typetrace graph` now accepts `--format <fmt>` instead of `--html`. The old `--html` flag is removed; use `--format html`.
- Mermaid output file is `typetrace.mmd` (standard Mermaid extension) rather than `typetrace.md`.

---

## [0.1.0] — 2026-06-27

### Added

- **`trace` command** — `typetrace trace <file>` resolves the first top-level symbol and prints its type inference steps as a numbered text list. Supports `--json` for machine-readable output.
- **`doctor` command** — `typetrace doctor` reports the active TypeScript version, tsconfig resolution status, and program health.
- **`version` command** — prints the CLI version string.
- **Project loader** (`@typetrace/project-loader`) — locates `tsconfig.json` by walking up the directory tree and builds a `ts.Program` via `createProgram()`.
- **Trace engine** (`@typetrace/trace-engine`) — walks `ts.Type` flags (`Union`, `Intersection`, `Conditional`, `Mapped`, `infer`) to reconstruct a `TraceResult` with per-step `sourceType → targetType` records. Three-layer in-memory cache (program, type, trace) keyed by tsconfig path and node ID.
- **Reporters** (`@typetrace/reporters`) — `TextReporter` and `JsonReporter` initial implementations; `ReporterFormat` union type and `createReporter` factory.
- **Monorepo workspace** — six packages under `packages/` (`cli`, `project-loader`, `trace-engine`, `graph-engine`, `reporters`, `shared`) wired together with TypeScript project references.

[0.2.0]: https://github.com/eraxel-dev/typetrace/releases/tag/v0.2.0
[0.1.0]: https://github.com/eraxel-dev/typetrace/releases/tag/v0.1.0
