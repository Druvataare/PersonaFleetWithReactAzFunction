/* Small numeric helpers, so the package has no runtime dependencies. */

export const clamp = (v: number): number => Math.max(0, Math.min(100, v));

export const sum = <T>(rows: readonly T[], fn: (row: T) => number): number =>
  rows.reduce((acc, row) => acc + fn(row), 0);

/** Arithmetic mean; 0 for an empty list (d3.mean would return undefined). */
export const mean = <T>(rows: readonly T[], fn: (row: T) => number): number =>
  rows.length ? sum(rows, fn) / rows.length : 0;
