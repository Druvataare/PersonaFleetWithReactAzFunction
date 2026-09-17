import { describe, expect, it } from "vitest";
import { RISK_RANK, securityRisk, switchMetrics, type SwitchContext } from "./switch.ts";
import { DEV_BASELINE, KW_BASELINE, device, onBaseline, struggling } from "./test/fixtures.ts";

const ctx: SwitchContext = {
  baselines: { DEV: DEV_BASELINE, KW: KW_BASELINE },
  apps: {
    DEV: ["Visual Studio Code", "Docker Desktop"],
    KW: ["Microsoft 365 Apps", "Visual Studio Code"],
  },
  tasksAutomated: { DEV: 14, KW: 8 },
  onboardingDays: { DEV: 3, KW: 1 },
};

describe("securityRisk", () => {
  it.each([
    [false, "Win10 22H2", "High"],
    [false, "Win11 24H2", "Medium"],
    [true, "Win10 22H2", "Medium"],
    [true, "Win11 24H2", "Low"],
  ] as const)("patched=%s on %s → %s", (patched, osBuild, risk) => {
    expect(securityRisk(device({ patched, osBuild }))).toBe(risk);
  });

  it("ranks risk levels", () => {
    expect(RISK_RANK.Low).toBeLessThan(RISK_RANK.Medium);
    expect(RISK_RANK.Medium).toBeLessThan(RISK_RANK.High);
  });
});

describe("switchMetrics", () => {
  const m = switchMetrics(struggling, "DEV", "KW", ctx);

  it("grades the device against the new persona's baseline", () => {
    // vs KW: prov (100 + 100 + 39/55) / 3 = 90.30; perf 0.6×30 + 0.4×78 = 49.2;
    // comp 25; exp (10/15 + 60/70) / 2 = 76.19 → composite 62.8 → 63
    expect(m.prodBefore).toBe(63);
    expect(m.prodAfter).toBe(96);
    expect(m.uxBefore).toBe(76);
    expect(m.uxAfter).toBe(95);
  });

  it("keeps the score against the current baseline for reference", () => {
    expect(m.baseFit).toBe(41); // 40.77 rounded
  });

  it("compares catalogues and what the device still needs", () => {
    expect(m.add).toEqual(["Microsoft 365 Apps"]);
    expect(m.rem).toEqual(["Docker Desktop"]);
    expect(m.need).toEqual(["Microsoft 365 Apps"]);
  });

  it("reports hardware fit and upgrades against the new baseline", () => {
    expect(m.fitBefore).toBe(false); // CPU 39 < 55
    expect(m).toMatchObject({ ramBefore: 16, ramAfter: 16, stBefore: 512, stAfter: 512 });
    expect(m).toMatchObject({ bootBefore: 80, bootAfter: 45 });
  });

  it("uses persona standards for tasks, onboarding, tickets and risk", () => {
    expect(m).toMatchObject({ tasksBefore: 14, tasksAfter: 8, onBefore: 3, onAfter: 1 });
    expect(m).toMatchObject({ tixBefore: 1, tixAfter: 0.09 });
    expect(m).toMatchObject({ riskBefore: "High", riskAfter: "Low" });
  });

  it("never lowers RAM or storage when moving to a lighter persona", () => {
    const up = switchMetrics(onBaseline, "DEV", "KW", ctx);
    expect(up).toMatchObject({ ramAfter: 32, stAfter: 1024, fitBefore: true });
  });

  it("raises RAM and storage to a heavier persona's baseline", () => {
    const heavier = switchMetrics(device({ ramGB: 16, storageGB: 512 }), "KW", "DEV", ctx);
    expect(heavier).toMatchObject({ ramAfter: 32, stAfter: 1024, fitBefore: false });
  });

  it("treats a persona with no catalogue as empty", () => {
    const none = switchMetrics(onBaseline, "DEV", "KW", { ...ctx, apps: {} });
    expect(none).toMatchObject({ add: [], rem: [], need: [] });
  });
});
