// generic-infer fixture — a constrained type parameter yields one `infer` step
// (the parameter is resolved to its base constraint).
export type Inferred<T extends string> = T;
