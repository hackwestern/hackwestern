/**
 * Normalize the result of `db.execute` across drivers: postgres-js returns the
 * rows as a bare array, PGlite (used by the Vitest harness) wraps them in
 * `{ rows }`. Raw-SQL callers go through this so the same code works in both.
 */
export function extractRows<T>(result: unknown): T[] {
  return Array.isArray(result)
    ? (result as T[])
    : ((result as { rows?: T[] }).rows ?? []);
}
