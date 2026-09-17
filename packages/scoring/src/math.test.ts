import { describe, expect, it } from "vitest";
import { clamp, mean, sum } from "./math.ts";

describe("math helpers", () => {
  it("clamps to 0–100", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(0)).toBe(0);
    expect(clamp(42.5)).toBe(42.5);
    expect(clamp(100)).toBe(100);
    expect(clamp(140)).toBe(100);
  });

  it("sums and averages with an accessor", () => {
    const rows = [{ v: 2 }, { v: 4 }, { v: 9 }];
    expect(sum(rows, (r) => r.v)).toBe(15);
    expect(mean(rows, (r) => r.v)).toBe(5);
  });

  it("returns 0 for empty lists instead of NaN", () => {
    expect(sum([], () => 1)).toBe(0);
    expect(mean([], () => 1)).toBe(0);
  });
});
