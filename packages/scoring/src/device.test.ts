import { describe, expect, it } from "vitest";
import { deviceScore, scoreDevice } from "./device.ts";
import { DEV_BASELINE, device, onBaseline, struggling } from "./test/fixtures.ts";

describe("scoreDevice", () => {
  it("scores 100 on every pillar when exactly on the baseline", () => {
    const s = scoreDevice(onBaseline, DEV_BASELINE);
    expect(s).toEqual({ prov: 100, perf: 100, comp: 100, exp: 100, underProv: false });
    expect(deviceScore(s)).toBe(100);
  });

  it("caps at 100 when above the baseline", () => {
    const s = scoreDevice(
      device({
        ramGB: 64,
        storageGB: 2048,
        cpuScore: 98,
        bootSec: 20,
        crashes: 0,
        freePct: 60,
        batteryPct: 100,
      }),
      DEV_BASELINE,
    );
    expect(s).toEqual({ prov: 100, perf: 100, comp: 100, exp: 100, underProv: false });
  });

  it("grades a struggling device proportionally on each pillar", () => {
    const s = scoreDevice(struggling, DEV_BASELINE);
    // RAM 16/32, SSD 512/1024, CPU 39/78 → each 50%
    expect(s.prov).toBeCloseTo(50, 6);
    // boot 80 vs 40 → 100 − 1.0×90 = 10; crashes 4 vs 2 → 100 − 2×22 = 56; 0.6×10 + 0.4×56
    expect(s.perf).toBeCloseTo(28.4, 6);
    // unpatched (20) + Windows 10 (5)
    expect(s.comp).toBe(25);
    // free 10/20 → 50; battery 60/75 → 80; averaged
    expect(s.exp).toBeCloseTo(65, 6);
    expect(s.underProv).toBe(true);
    // 0.35×50 + 0.3×28.4 + 0.2×25 + 0.15×65
    expect(deviceScore(s)).toBeCloseTo(40.77, 6);
  });

  it("flags under-provisioning when any single part is below", () => {
    expect(scoreDevice(device({ ramGB: 16 }), DEV_BASELINE).underProv).toBe(true);
    expect(scoreDevice(device({ storageGB: 512 }), DEV_BASELINE).underProv).toBe(true);
    expect(scoreDevice(device({ cpuScore: 77 }), DEV_BASELINE).underProv).toBe(true);
  });

  it("does not flag under-provisioning for performance or experience misses", () => {
    const s = scoreDevice(device({ bootSec: 90, crashes: 8, freePct: 5, batteryPct: 50 }), DEV_BASELINE);
    expect(s.underProv).toBe(false);
    expect(s.prov).toBe(100);
  });

  it("clamps performance to 0 for extreme boot times and crashes", () => {
    expect(scoreDevice(device({ bootSec: 200, crashes: 10 }), DEV_BASELINE).perf).toBe(0);
  });

  it.each([
    [true, "Win11 24H2", 100],
    [true, "Win10 22H2", 75],
    [false, "Win11 23H2", 50],
    [false, "Win10 22H2", 25],
  ] as const)("compliance: patched=%s on %s → %s", (patched, osBuild, expected) => {
    expect(scoreDevice(device({ patched, osBuild }), DEV_BASELINE).comp).toBe(expected);
  });

  it("only counts Windows 11 when the build name starts with it", () => {
    expect(scoreDevice(device({ osBuild: "Upgraded to Win11" }), DEV_BASELINE).comp).toBe(75);
  });
});

describe("deviceScore", () => {
  it("weights provisioning 35%, performance 30%, compliance 20%, experience 15%", () => {
    expect(deviceScore({ prov: 100, perf: 0, comp: 0, exp: 0 })).toBeCloseTo(35);
    expect(deviceScore({ prov: 0, perf: 100, comp: 0, exp: 0 })).toBeCloseTo(30);
    expect(deviceScore({ prov: 0, perf: 0, comp: 100, exp: 0 })).toBeCloseTo(20);
    expect(deviceScore({ prov: 0, perf: 0, comp: 0, exp: 100 })).toBeCloseTo(15);
  });
});
