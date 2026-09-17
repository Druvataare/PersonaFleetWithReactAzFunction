import { describe, expect, it } from "vitest";
import { DEFAULT_BASELINE } from "../mocks/data/catalog.ts";
import { useUi } from "./ui.ts";

describe("UI store", () => {
  it("toggles motion and chart names", () => {
    const s = useUi.getState();
    s.toggleMotion();
    s.toggleChartNames();
    expect(useUi.getState()).toMatchObject({ motion: true, chartNames: true });
  });

  it("keeps draft baselines per persona and resets one without touching others", () => {
    const { setBaselineField } = useUi.getState();
    setBaselineField("DEV", DEFAULT_BASELINE.DEV, "ramGB", 64);
    setBaselineField("DEV", DEFAULT_BASELINE.DEV, "cpuScore", 90);
    setBaselineField("KW", DEFAULT_BASELINE.KW, "ticketsPer100", 20);
    expect(useUi.getState().draftBaselines.DEV).toEqual({ ...DEFAULT_BASELINE.DEV, ramGB: 64, cpuScore: 90 });
    useUi.getState().resetBaseline("DEV");
    expect(useUi.getState().draftBaselines).toEqual({ KW: { ...DEFAULT_BASELINE.KW, ticketsPer100: 20 } });
  });

  it("resets filters to their defaults", () => {
    useUi.getState().set({ personaFilter: "risk", ticketKind: "req", mappingBand: "low", deviceQuery: "x" });
    useUi.getState().resetFilters();
    expect(useUi.getState()).toMatchObject({
      personaFilter: "all",
      ticketKind: "inc",
      mappingBand: null,
      deviceQuery: "",
    });
  });

  it("persists only preferences", async () => {
    useUi.getState().setTheme("nord");
    useUi.getState().set({ personaFilter: "risk" });
    const saved = JSON.parse(localStorage.getItem("pfc-ui") ?? "{}");
    expect(saved.state).toEqual({ theme: "nord", motion: false, chartNames: false });
  });

  it("ignores an invalid theme in storage", async () => {
    localStorage.setItem("pfc-ui", JSON.stringify({ state: { theme: "neon", motion: true }, version: 1 }));
    await useUi.persist.rehydrate();
    expect(useUi.getState()).toMatchObject({ theme: "midnight", motion: true });
  });
});
