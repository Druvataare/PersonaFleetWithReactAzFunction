/* Aggregations used by both the mock API and the browser. */
import type { Priority } from "@pfc/scoring";
import type { AgeBucket, FleetTicket, KeyCount } from "../api/types.ts";

/** Counts by key, highest first; ties keep first-seen order (as the wireframe's tally). */
export function tally<T>(rows: readonly T[], key: (row: T) => string): KeyCount[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return [...counts].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
}

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];
const AGE_BUCKETS: ReadonlyArray<[string, number, number]> = [
  ["0-7", 0, 7],
  ["8-14", 8, 14],
  ["15-21", 15, 21],
  ["22+", 22, 999],
];

export function ageByPriority(rows: readonly Pick<FleetTicket, "ageDays" | "priority">[]): AgeBucket[] {
  return AGE_BUCKETS.map(([label, lo, hi]) => {
    const inBucket = rows.filter((t) => t.ageDays >= lo && t.ageDays <= hi);
    const vals = PRIORITIES.map((p) => inBucket.filter((t) => t.priority === p).length) as AgeBucket["vals"];
    return { label, vals, total: inBucket.length };
  });
}
