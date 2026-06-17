import path from "node:path";

/** Absolute path to the project's ./public directory. */
export const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * Resolve `target` against `base` and guarantee the result stays inside `base`.
 * Throws on any path that escapes (e.g. "../../etc/passwd" or an absolute path).
 * Returns the resolved absolute path.
 */
export function assertWithin(base: string, target: string): string {
  const resolved = path.resolve(base, target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Refusing to access path outside ${base}: ${target}`);
  }
  return resolved;
}
