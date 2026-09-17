import { describe, expect, it } from "vitest";
import { FIT_KINDS, fitByPersona, fitClass } from "./fit.ts";
import { buildPersonaModel } from "./persona.ts";
import { DEV_BASELINE, DEV_PERSONA, DEV_WEIGHTS, device, onBaseline, struggling } from "./test/fixtures.ts";

const b = DEV_BASELINE; // RAM 32, SSD 1024, CPU 78

describe("fitClass", () => {
  it.each([
    ["exactly on baseline", { ramGB: 32, storageGB: 1024, cpuScore: 78 }, "fit"],
    ["above on RAM only", { ramGB: 64, storageGB: 1024, cpuScore: 78 }, "over"],
    ["above on every part", { ramGB: 64, storageGB: 2048, cpuScore: 98 }, "over"],
    ["below on RAM only", { ramGB: 16, storageGB: 1024, cpuScore: 78 }, "under"],
    ["below on CPU only", { ramGB: 32, storageGB: 1024, cpuScore: 60 }, "under"],
    ["below on one part, above on another", { ramGB: 64, storageGB: 1024, cpuScore: 60 }, "under"],
    ["below on two parts", { ramGB: 16, storageGB: 512, cpuScore: 78 }, "crit"],
    ["below on all three parts", { ramGB: 8, storageGB: 256, cpuScore: 40 }, "crit"],
  ] as const)("%s → %s", (_name, parts, expected) => {
    expect(fitClass(parts, b)).toBe(expected);
  });

  it("ignores boot time, crashes, disk headroom and battery", () => {
    expect(fitClass(device({ bootSec: 120, crashes: 9, freePct: 5, batteryPct: 40 }), b)).toBe("fit");
  });
});

describe("FIT_KINDS", () => {
  it("lists the four categories in display order", () => {
    expect(FIT_KINDS.map((k) => k.key)).toEqual(["fit", "under", "over", "crit"]);
    expect(FIT_KINDS.map((k) => k.label)).toEqual([
      "Fit devices",
      "Under provisioned",
      "Over-provisioned",
      "Critically mismatched",
    ]);
  });
});

describe("fitByPersona", () => {
  const model = buildPersonaModel({
    persona: DEV_PERSONA, // headcount 1000
    devices: [
      onBaseline,
      struggling,
      device({ id: "DEV-0003", ramGB: 64 }),
      device({ id: "DEV-0004", cpuScore: 70 }),
    ],
    baseline: DEV_BASELINE,
    weights: DEV_WEIGHTS,
    migrations: [],
    exceptions: [],
  });
  const [row] = fitByPersona([model]);

  it("scales sample counts to headcount", () => {
    // 4 samples → each represents 250 people
    expect(row).toMatchObject({ id: "DEV", total: 1000, fit: 250, under: 250, over: 250, crit: 250 });
  });

  it("reports the share meeting the baseline on each component", () => {
    // CPU: struggling (39) and DEV-0004 (70) miss → 50%
    expect(row.cpuPct).toBe(50);
    // RAM: only struggling misses → 75%
    expect(row.ramPct).toBe(75);
    // SSD: only struggling misses → 75%
    expect(row.ssdPct).toBe(75);
  });

  it("returns zeros for a persona with no sample devices", () => {
    const empty = buildPersonaModel({
      persona: DEV_PERSONA,
      devices: [],
      baseline: DEV_BASELINE,
      weights: DEV_WEIGHTS,
      migrations: [],
      exceptions: [],
    });
    expect(fitByPersona([empty])[0]).toMatchObject({
      fit: 0,
      under: 0,
      over: 0,
      crit: 0,
      cpuPct: 0,
      ramPct: 0,
      ssdPct: 0,
    });
  });
});
