import type { Tone } from "./types.ts";

/** Health band: 85+ healthy, 70–84 watch, below 70 at risk. */
export const healthTone = (v: number): Tone => (v >= 85 ? "good" : v >= 70 ? "warn" : "bad");

export const healthLabel = (v: number): "Healthy" | "Watch" | "At risk" =>
  v >= 85 ? "Healthy" : v >= 70 ? "Watch" : "At risk";

export type ConfidenceBand = "100" | "50" | "low";

/** Job-title mapping confidence: 100 needs no review, 50–99 review recommended, below 50 attention. */
export const confBand = (c: number): ConfidenceBand => (c >= 100 ? "100" : c >= 50 ? "50" : "low");

/** CPU benchmark index shown as a familiar tier. */
export const cpuTier = (v: number): string =>
  v >= 80 ? "Intel Core i9" : v >= 62 ? "Intel Core i7" : v >= 45 ? "Intel Core i5" : "Intel Core i3";

/** Patch-compliance share by site: 90%+ good, 75–89% warn, below 75% bad. */
export const complianceTone = (pct: number): Tone => (pct >= 90 ? "good" : pct >= 75 ? "warn" : "bad");
