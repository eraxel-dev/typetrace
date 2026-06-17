# Unravel

**TypeScript Type Inference Debugger**

Version: 1.0.0

---

## 1. Overview

Unravel is a CLI tool that analyzes the TypeScript Compiler's type inference process and visualizes the step-by-step path taken to arrive at a final type.

**Problem:** TypeScript today only shows the final result:

```ts
const result = fetchUser()
// → User | null
```

**Solution:** Unravel shows how that result was reached:

```
fetchUser()
  ↓ infer T
ApiResponse<User>
  ↓ conditional
ExtractData<T>
  ↓ infer U
User
  ↓ union
User | null
```

---

## 2. Product Goals

**Goal:** TypeScript developers can understand *why* a symbol has a given type.

**Non-Goals:**
- Type-checking speed improvements
- LSP implementation
- VS Code extension
- AI code generation

---

## 3. Core Features

### `trace` — Show type inference path

```sh
unravel trace src/index.ts
```

Output:
```
Symbol: result
Step 1  ApiResponse<User>
Step 2  ExtractData<T>
Step 3  infer U
Step 4  User
Step 5  User | null
```

### `explain` — Natural-language explanation of inference

```sh
unravel explain src/index.ts
```

Output:
```
User | null

Reason:
  T extends ApiResponse<infer U>
  U was inferred as User
  OptionalResult added null

Final type: User | null
```

### `graph` — Generate inference graph

```sh
unravel graph src/index.ts
```

Output: `unravel.svg`

### `--json` flag — Machine-readable output

```sh
unravel trace src/index.ts --json
```

Output:
```json
{
  "symbol": "result",
  "finalType": "User | null",
  "steps": []
}
```

---

## 4. Supported Type Features

| Version | Features |
|---------|----------|
| v1 | Generic, `infer`, Conditional Type, Union, Intersection, Mapped Type |
| v2 | Template Literal Type, Recursive Type, Utility Type |
| v3 | Compiler Internal Trace, Full Debugger Mode |

---

## 5. Performance Requirements

| Scale | Command | Target |
|-------|---------|--------|
| 1,000 files | `trace` | < 500ms |
| 10,000 files | `trace` | < 3s |

---

## 6. Error Handling

| Condition | Message | Exit Code |
|-----------|---------|-----------|
| `tsconfig.json` not found | `Cannot locate tsconfig.json` | 1 |
| Symbol resolution failure | `Failed to resolve symbol` | 1 |

---

## 7. Output Formats

- `text` (default)
- `json`
- `svg`
- `html`
- `mermaid`

---

## 8. CLI Specification

```sh
unravel trace <file>      # Show type inference steps
unravel explain <file>    # Explain inference in plain English
unravel graph <file>      # Generate SVG inference graph
unravel doctor            # Diagnose environment
unravel version           # Print version
```

---

## 9. `doctor` — Environment Diagnostics

```sh
unravel doctor
```

Output:
```
TypeScript: 5.9.0
tsconfig:   OK
Program:    OK
Cache:      OK
```

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| GitHub Stars | 3,000+ |
| Weekly Downloads | 10,000+ |
| Time to First Value | < 30 seconds |
| README GIF | Communicates value without reading |
