// @vitest-environment node
/* Entitlement and suggested actions for every sample device, compared with the
   wireframe's screenDevice logic run on the wireframe's own data. */
import { describe, expect, it } from "vitest";
import { loadWireframe } from "../mocks/data/wireframe.ts";
import { entitlement, suggestedActions } from "./deviceActions.ts";
import { gb } from "./format.ts";

/* eslint-disable @typescript-eslint/no-explicit-any -- wireframe objects are untyped */
const wf = loadWireframe();

/** The wireframe's own expressions, copied from screenDevice. */
function wireframeActions(p: any, d: any) {
  const b = p.baseline;
  const req = wf.APPS[p.id];
  const missing = req.filter((a: string) => d.installed.indexOf(a) < 0);
  const outside = d.installed.filter((a: string) => req.indexOf(a) < 0);
  const acts = [
    d.ramGB < b.ramGB && `Upgrade memory to ${b.ramGB}GB to meet the ${p.name} baseline`,
    d.storageGB < b.storageGB && `Replace disk — ${gb(b.storageGB)} required`,
    d.cpuScore < b.cpuScore && "Schedule refresh — CPU index below persona floor",
    !d.patched && "Force patch ring re-evaluation",
    d.freePct < b.freePct && "Run storage clean-up policy",
    missing.length && `Push ${missing.length} missing persona app${missing.length > 1 ? "s" : ""}`,
    outside.length &&
      `Raise exception or remove ${outside.length} non-persona app${outside.length > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return {
    entitled: d.installed.filter((a: string) => req.indexOf(a) >= 0),
    missing,
    outside,
    acts,
  };
}

describe("device rules match the wireframe for all 182 sample devices", () => {
  const model: any[] = wf.buildModel(wf.DEFAULT_BASELINE);
  const cases = model.flatMap((p) => p.devices.map((d: any) => [d.id, p, d] as const));

  it.each(cases)("%s", (_id, p, d) => {
    const want = wireframeActions(p, d);
    const e = entitlement(d.installed, wf.APPS[p.id]);
    expect(e).toEqual({ entitled: want.entitled, missing: want.missing, outside: want.outside });
    expect(suggestedActions(d, p.baseline, p.name, e)).toEqual(want.acts);
  });

  it("covers every kind of action somewhere in the sample", () => {
    const all = cases.flatMap(([, p, d]) => wireframeActions(p, d).acts as string[]);
    for (const start of [
      "Upgrade memory",
      "Replace disk",
      "Schedule refresh",
      "Force patch",
      "Run storage",
      "Push ",
      "Raise exception",
    ]) {
      expect(
        all.some((a) => a.startsWith(start)),
        start,
      ).toBe(true);
    }
  });
});

describe("suggestedActions", () => {
  it("is empty for a device that meets every baseline and has exactly the catalogue", () => {
    const b = {
      ramGB: 16,
      storageGB: 512,
      cpuScore: 50,
      bootSec: 40,
      crashes: 2,
      freePct: 15,
      batteryPct: 70,
      ticketsPer100: 9,
    };
    const d = { ramGB: 32, storageGB: 1024, cpuScore: 90, patched: true, freePct: 40 } as any;
    const e = entitlement(["A", "B"], ["A", "B"]);
    expect(suggestedActions(d, b, "Knowledge Worker", e)).toEqual([]);
  });

  it("uses singular and plural app wording", () => {
    const b = {
      ramGB: 8,
      storageGB: 256,
      cpuScore: 1,
      bootSec: 40,
      crashes: 2,
      freePct: 1,
      batteryPct: 1,
      ticketsPer100: 9,
    };
    const d = { ramGB: 8, storageGB: 256, cpuScore: 50, patched: true, freePct: 50 } as any;
    expect(suggestedActions(d, b, "X", entitlement(["Z"], ["A"]))).toEqual([
      "Push 1 missing persona app",
      "Raise exception or remove 1 non-persona app",
    ]);
    expect(suggestedActions(d, b, "X", entitlement(["Y", "Z"], ["A", "B"]))).toEqual([
      "Push 2 missing persona apps",
      "Raise exception or remove 2 non-persona apps",
    ]);
  });
});
