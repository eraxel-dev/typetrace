import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Walk up the directory tree starting from `startDir`, returning the absolute
 * path to the first `tsconfig.json` encountered.
 *
 * The search begins in `startDir` itself and ascends one parent at a time until
 * a `tsconfig.json` is found or the filesystem root is reached. If none is
 * found, an error is thrown whose message exactly matches the contract shared
 * with `@unravel/project-loader` so that callers can surface a single,
 * consistent diagnostic.
 *
 * @param startDir - the directory to begin searching from (absolute or relative)
 * @returns the absolute path to the located `tsconfig.json`
 * @throws Error with message `"Cannot locate tsconfig.json"` when no config is found
 */
export function findTsconfig(startDir: string): string {
  let current = resolve(startDir);

  for (;;) {
    const candidate = join(current, "tsconfig.json");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error("Cannot locate tsconfig.json");
    }
    current = parent;
  }
}
