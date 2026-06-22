// conditional-type fixture — a deferred conditional yields one `conditional`
// step (the extends check); its branches stay unresolved while T is generic.
export type IsString<T> = T extends string ? "yes" : "no";
