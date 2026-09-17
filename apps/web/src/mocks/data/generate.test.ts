// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateFleetData } from "./generate.ts";
import { mulberry32 } from "./random.ts";

const data = generateFleetData();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("mulberry32", () => {
  it("is deterministic for a seed and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateFleetData", () => {
  it("builds the wireframe estate: 7 personas and 12,095 devices", () => {
    expect(data.personas.map((p) => p.id)).toEqual(["DEV", "KW", "CC", "FIELD", "EXEC", "DS", "CRE"]);
    expect(sum(data.personas.map((p) => p.count))).toBe(12095);
  });

  it("creates 182 sample devices: 34 Knowledge Worker, 28 Contact Centre, 24 for the rest", () => {
    const sizes = Object.fromEntries(Object.entries(data.devicesByPersona).map(([k, v]) => [k, v.length]));
    expect(sizes).toEqual({ DEV: 24, KW: 34, CC: 28, FIELD: 24, EXEC: 24, DS: 24, CRE: 24 });
  });

  it("maps one job title per person", () => {
    expect(data.titleRows).toHaveLength(12095);
  });

  it("creates 56 app exceptions (6 named, 50 generated), 15 pending", () => {
    expect(data.exceptions).toHaveLength(56);
    expect(data.exceptions[0].id).toBe("RITM0049211");
    expect(data.exceptions.filter((e) => e.state === "Pending")).toHaveLength(15);
  });

  it("creates 2,063 incidents and 1,438 service requests", () => {
    expect(data.incidents).toHaveLength(2063);
    expect(data.requests).toHaveLength(1438);
    expect(data.incidents.every((t) => t.id.startsWith("INC00"))).toBe(true);
    expect(data.requests.every((t) => t.id.startsWith("RITM00"))).toBe(true);
  });

  it("gives every sample device a unique id and a valid shape", () => {
    const devices = Object.values(data.devicesByPersona).flat();
    expect(new Set(devices.map((d) => d.id)).size).toBe(devices.length);
    devices.forEach((d) => {
      expect(d.email).toMatch(/^[a-z]+\.[a-z]+@contoso\.com$/);
      expect(d.tickets.length).toBeLessThanOrEqual(3);
      expect(d.freePct).toBeGreaterThanOrEqual(6);
      expect(d.batteryPct).toBeLessThanOrEqual(100);
    });
  });

  it("keeps SLA and week fields consistent with ticket age", () => {
    [...data.incidents, ...data.requests].forEach((t) => {
      expect(t.week).toBe(Math.min(11, Math.floor(t.ageDays / 7)));
      if (t.sla) expect(t.open).toBe(true);
    });
  });

  it("is deterministic and depends on the seed", () => {
    expect(generateFleetData()).toEqual(data);
    expect(generateFleetData(1).devicesByPersona).not.toEqual(data.devicesByPersona);
  });

  it("returns independent copies of shared reference data", () => {
    const a = generateFleetData();
    a.apps.DEV.push("Changed");
    a.migrations[0].people = 0;
    const b = generateFleetData();
    expect(b.apps.DEV).not.toContain("Changed");
    expect(b.migrations[0].people).toBe(148);
  });
});
