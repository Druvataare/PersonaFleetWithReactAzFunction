import { describe, expect, it } from "vitest";
import { buildModel, buildPersonaModel, personaHealth, supportScore } from "./persona.ts";
import {
  DEV_BASELINE,
  DEV_PERSONA,
  DEV_WEIGHTS,
  EXCEPTIONS,
  KW_BASELINE,
  KW_PERSONA,
  KW_WEIGHTS,
  MIGRATIONS,
  onBaseline,
  struggling,
} from "./test/fixtures.ts";

describe("supportScore", () => {
  it("is 100 at or under the ticket ceiling", () => {
    expect(supportScore(0, 12)).toBe(100);
    expect(supportScore(12, 12)).toBe(100);
  });

  it("drops 70 points for every 100% over the ceiling", () => {
    expect(supportScore(50, 40)).toBeCloseTo(82.5); // 25% over → −17.5
    expect(supportScore(24, 12)).toBeCloseTo(30); // 100% over → −70
  });

  it("clamps at 0", () => {
    expect(supportScore(50, 12)).toBe(0);
  });
});

describe("personaHealth", () => {
  it("is the weighted average of the five pillars", () => {
    const pillars = { prov: 75, perf: 64.2, comp: 62.5, exp: 82.5, sup: 82.5 };
    expect(personaHealth(pillars, DEV_WEIGHTS)).toBeCloseTo(71.76, 6);
  });

  it("normalises weights that do not sum to 100", () => {
    const pillars = { prov: 80, perf: 80, comp: 80, exp: 80, sup: 80 };
    expect(personaHealth(pillars, { prov: 1, perf: 1, comp: 1, exp: 1, sup: 1 })).toBeCloseTo(80);
  });
});

describe("buildPersonaModel", () => {
  const model = buildPersonaModel({
    persona: DEV_PERSONA,
    devices: [onBaseline, struggling],
    baseline: { ...DEV_BASELINE, ticketsPer100: 40 },
    weights: DEV_WEIGHTS,
    migrations: MIGRATIONS,
    exceptions: EXCEPTIONS,
  });

  it("keeps identity and headcount separate from device rows", () => {
    expect(model).toMatchObject({ id: "DEV", name: "Engineering", count: 1000 });
    expect(model.devices).toHaveLength(2);
  });

  it("scores every device", () => {
    expect(model.devices[0].score).toBe(100);
    expect(model.devices[1].score).toBeCloseTo(40.77, 6);
    expect(model.devices[1].s.underProv).toBe(true);
  });

  it("averages pillars across devices and grades ticket load", () => {
    expect(model.pillars.prov).toBeCloseTo(75, 6);
    expect(model.pillars.perf).toBeCloseTo(64.2, 6);
    expect(model.pillars.comp).toBeCloseTo(62.5, 6);
    expect(model.pillars.exp).toBeCloseTo(82.5, 6);
    // 1 ticket across 2 devices = 50 per 100 against a ceiling of 40
    expect(model.ticketsPer100).toBe(50);
    expect(model.pillars.sup).toBeCloseTo(82.5, 6);
    expect(model.health).toBeCloseTo(71.76, 6);
  });

  it("scales sample shares to headcount", () => {
    expect(model.underPct).toBe(0.5);
    expect(model.underCount).toBe(500);
    expect(model.openTickets).toBe(500);
  });

  it("summarises patching and boot time", () => {
    expect(model.patchPct).toBe(50);
    expect(model.avgBoot).toBe(60);
  });

  it("counts people moving in and out", () => {
    expect(model.movedIn).toBe(96);
    expect(model.movedOut).toBe(10);
  });

  it("keeps only this persona's exceptions and counts pending ones", () => {
    expect(model.exceptions.map((e) => e.id)).toEqual(["RITM1", "RITM2"]);
    expect(model.excPending).toBe(1);
  });

  it("does not mutate the input devices", () => {
    expect("score" in onBaseline).toBe(false);
  });
});

describe("buildModel", () => {
  const models = buildModel({
    personas: [DEV_PERSONA, KW_PERSONA],
    devicesByPersona: { DEV: [onBaseline, struggling] },
    baselines: { DEV: DEV_BASELINE, KW: KW_BASELINE },
    weights: { DEV: DEV_WEIGHTS, KW: KW_WEIGHTS },
    migrations: MIGRATIONS,
    exceptions: EXCEPTIONS,
  });

  it("returns one model per persona in persona order", () => {
    expect(models.map((m) => m.id)).toEqual(["DEV", "KW"]);
  });

  it("uses each persona's own baseline", () => {
    // 1 ticket / 2 devices = 50 per 100, over DEV's ceiling of 12 → support clamps to 0
    expect(models[0].pillars.sup).toBe(0);
    expect(models[0].baseline).toBe(DEV_BASELINE);
    expect(models[1].baseline).toBe(KW_BASELINE);
  });

  it("handles a persona with no sample devices without producing NaN", () => {
    const kw = models[1];
    expect(kw.devices).toHaveLength(0);
    expect(kw.underPct).toBe(0);
    expect(kw.underCount).toBe(0);
    expect(kw.openTickets).toBe(0);
    expect(kw.ticketsPer100).toBe(0);
    expect(kw.pillars).toEqual({ prov: 0, perf: 0, comp: 0, exp: 0, sup: 100 });
    // only the support pillar contributes: 100 × 20 / 100
    expect(kw.health).toBeCloseTo(20);
    expect(Number.isNaN(kw.health)).toBe(false);
    expect(kw.movedOut).toBe(96);
    expect(kw.excPending).toBe(1);
  });

  it("re-grades when a baseline changes", () => {
    const relaxed = buildModel({
      personas: [DEV_PERSONA],
      devicesByPersona: { DEV: [onBaseline, struggling] },
      baselines: { DEV: { ...DEV_BASELINE, ramGB: 16, storageGB: 512, cpuScore: 39 } },
      weights: { DEV: DEV_WEIGHTS },
      migrations: [],
      exceptions: [],
    })[0];
    expect(relaxed.underPct).toBe(0);
    expect(relaxed.pillars.prov).toBe(100);
    expect(relaxed.health).toBeGreaterThan(models[0].health);
  });
});
