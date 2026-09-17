import { describe, expect, it } from "vitest";
import { complianceTone, confBand, cpuTier, healthLabel, healthTone } from "./bands.ts";

describe("health bands", () => {
  it.each([
    [100, "good", "Healthy"],
    [85, "good", "Healthy"],
    [84.99, "warn", "Watch"],
    [70, "warn", "Watch"],
    [69.99, "bad", "At risk"],
    [0, "bad", "At risk"],
  ] as const)("%s → %s / %s", (v, tone, label) => {
    expect(healthTone(v)).toBe(tone);
    expect(healthLabel(v)).toBe(label);
  });
});

describe("confidence bands", () => {
  it.each([
    [100, "100"],
    [99, "50"],
    [50, "50"],
    [49, "low"],
    [12, "low"],
  ] as const)("%s%% → %s", (c, band) => {
    expect(confBand(c)).toBe(band);
  });
});

describe("CPU tier", () => {
  it.each([
    [98, "Intel Core i9"],
    [80, "Intel Core i9"],
    [79, "Intel Core i7"],
    [62, "Intel Core i7"],
    [61, "Intel Core i5"],
    [45, "Intel Core i5"],
    [44, "Intel Core i3"],
  ] as const)("index %s → %s", (v, tier) => {
    expect(cpuTier(v)).toBe(tier);
  });
});

describe("patch compliance tone", () => {
  it.each([
    [100, "good"],
    [90, "good"],
    [89, "warn"],
    [75, "warn"],
    [74, "bad"],
  ] as const)("%s%% → %s", (pct, tone) => {
    expect(complianceTone(pct)).toBe(tone);
  });
});
