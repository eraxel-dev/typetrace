// nested fixture — a union of conditionals: the top-level union wraps two
// conditional members, each of which resolves a branch, yielding 3+ steps.
export type Describe<T> =
  | (T extends string ? "is-string" : "not-string")
  | (T extends number ? "is-number" : "not-number");
