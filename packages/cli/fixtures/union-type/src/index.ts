// union-type fixture — a two-member union yields two `union` steps.
export interface Cat {
  meow(): void;
}

export interface Dog {
  bark(): void;
}

export const pet: Cat | Dog = { meow() {} };
