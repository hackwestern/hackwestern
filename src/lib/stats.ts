/**
 * Small statistics helpers used by judging score normalization.
 *
 * These all operate on plain arrays of numbers so they are trivially
 * unit-testable and free of any database concerns.
 */

/** Arithmetic mean. Returns 0 for an empty array. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Population standard deviation (divides by n, not n - 1).
 *
 * We use the population form because each judge's marks are treated as the
 * full population of that judge's opinions, matching the σ = √((S2/n) − (S/n)²)
 * formula sketched on the `judges` table.
 *
 * Pass `precomputedMean` to avoid recomputing the mean when the caller already
 * has it. Returns 0 for an empty array or a single value (no spread).
 */
export function populationStdDev(
  values: number[],
  precomputedMean?: number,
): number {
  if (values.length === 0) return 0;
  const m = precomputedMean ?? mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
