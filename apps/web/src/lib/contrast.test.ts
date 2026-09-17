// @vitest-environment node
import { describe, expect, it } from "vitest";
import { THEME_KEYS, THEMES } from "../theme/themes.ts";
import { blend, contrastRatio, readableOn } from "./contrast.ts";

describe("contrast helpers", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("blends a tint over a surface", () => {
    expect(blend("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    expect(blend("#FF0000", "#000000", 0.1)).toBe("#1A0000");
  });

  it("leaves readable colours alone and nudges unreadable ones to 4.5:1", () => {
    expect(readableOn("#FFFFFF", "#000000", "#FFFFFF")).toBe("#FFFFFF");
    const nudged = readableOn("#8A93AC", "#FFFFFF", "#161C2E");
    expect(contrastRatio(nudged, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme palettes meet WCAG AA", () => {
  const surfaces = ["bg", "bgDeep", "panel", "panel2"] as const;
  const textColours = ["text", "dim", "faint", "accent", "good", "warn", "bad", "cyan", "fresh"] as const;
  it.each(THEME_KEYS)("%s: every text colour is at least 4.5:1 on every surface", (key) => {
    const t = THEMES[key];
    for (const fg of textColours) {
      for (const bg of surfaces) {
        expect(contrastRatio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
