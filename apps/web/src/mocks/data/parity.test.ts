// @vitest-environment node
/* Parity with the wireframe: the generator must reproduce its sample data
   exactly, and @pfc/scoring must produce the same persona numbers. */
import { buildModel, fitByPersona } from "@pfc/scoring";
import { describe, expect, it } from "vitest";
import { generateFleetData } from "./generate.ts";
import { loadWireframe } from "./wireframe.ts";

const wf = loadWireframe();
const data = generateFleetData();

describe("sample data matches the wireframe exactly", () => {
  it("personas", () => {
    expect(data.personas).toEqual(
      wf.RAW.map(({ id, name, sub, count, hue }) => ({ id, name, sub, count, hue })),
    );
  });

  it("app catalogues, default baselines and weights", () => {
    expect(data.apps).toEqual(wf.APPS);
    expect(data.defaultBaselines).toEqual(wf.DEFAULT_BASELINE);
    expect(data.weights).toEqual(wf.WEIGHTS);
  });

  it("sample devices, including tickets and installed apps", () => {
    wf.RAW.forEach((p) => expect(data.devicesByPersona[p.id], p.id).toEqual(p.sample));
  });

  it("migrations and app exceptions", () => {
    expect(data.migrations).toEqual(wf.MIGRATIONS);
    expect(data.exceptions).toEqual(wf.EXCEPTIONS);
  });

  it("job-title mapping rows", () => {
    expect(data.titleRows).toEqual(wf.TITLE_ROWS);
  });

  it("incidents and service requests", () => {
    expect(data.incidents).toEqual(wf.INCIDENTS);
    expect(data.requests).toEqual(wf.REQUESTS);
  });
});

describe("@pfc/scoring matches the wireframe's buildModel", () => {
  const expected = wf.buildModel(wf.DEFAULT_BASELINE);
  const actual = buildModel({
    personas: data.personas,
    devicesByPersona: data.devicesByPersona,
    baselines: data.defaultBaselines,
    weights: data.weights,
    migrations: data.migrations,
    exceptions: data.exceptions,
  });

  it.each(expected.map((p) => [p.id, p]))("%s persona totals", (id, want) => {
    const got = actual.find((p) => p.id === id)!;
    expect(got.health).toBeCloseTo(want.health, 9);
    for (const k of ["prov", "perf", "comp", "exp", "sup"] as const) {
      expect(got.pillars[k], k).toBeCloseTo(want.pillars[k], 9);
    }
    expect(got.underPct).toBeCloseTo(want.underPct, 9);
    expect(got.ticketsPer100).toBeCloseTo(want.ticketsPer100, 9);
    expect(got.patchPct).toBeCloseTo(want.patchPct, 9);
    expect(got.avgBoot).toBeCloseTo(want.avgBoot, 9);
    expect({
      underCount: got.underCount,
      openTickets: got.openTickets,
      movedIn: got.movedIn,
      movedOut: got.movedOut,
      exceptions: got.exceptions.length,
      excPending: got.excPending,
    }).toEqual({
      underCount: want.underCount,
      openTickets: want.openTickets,
      movedIn: want.movedIn,
      movedOut: want.movedOut,
      exceptions: want.exceptions.length,
      excPending: want.excPending,
    });
    got.devices.forEach((d, i) => {
      expect(d.score, d.id).toBeCloseTo(want.devices[i].score, 9);
      expect(d.s.underProv, d.id).toBe(want.devices[i].s.underProv);
    });
  });

  it("device fit by persona", () => {
    expect(fitByPersona(actual)).toEqual(wf.fitByPersona(expected));
  });

  it("re-grades identically when a baseline changes", () => {
    const edited = {
      ...wf.DEFAULT_BASELINE,
      DEV: { ...wf.DEFAULT_BASELINE.DEV, ramGB: 64, ticketsPer100: 20 },
    };
    const want = wf.buildModel(edited).find((p) => p.id === "DEV");
    const got = buildModel({
      personas: data.personas,
      devicesByPersona: data.devicesByPersona,
      baselines: edited,
      weights: data.weights,
      migrations: data.migrations,
      exceptions: data.exceptions,
    }).find((p) => p.id === "DEV")!;
    expect(got.health).toBeCloseTo(want.health, 9);
    expect(got.underCount).toBe(want.underCount);
  });
});
