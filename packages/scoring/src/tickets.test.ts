import { describe, expect, it } from "vitest";
import { gradeTicketLoad, ticketBaselinePerUser, ticketStatus } from "./tickets.ts";

describe("ticketBaselinePerUser", () => {
  it("converts tickets per 100 devices to tickets per user", () => {
    expect(ticketBaselinePerUser({ ticketsPer100: 12 })).toBe(0.12);
  });
});

describe("ticketStatus", () => {
  it.each([
    [0.1, "Within baseline", "good"],
    [0.12, "Within baseline", "good"],
    [0.15, "Near baseline", "warn"],
    [0.17, "Near baseline", "warn"],
    [0.19, "Over baseline", "bad"],
  ] as const)("%s per user against 0.12 → %s", (per, label, tone) => {
    expect(ticketStatus(per, 0.12)).toEqual({ label, tone });
  });
});

describe("gradeTicketLoad", () => {
  it("is within baseline exactly on the ceiling", () => {
    const g = gradeTicketLoad(120, 1000, { ticketsPer100: 12 });
    expect(g.per).toBeCloseTo(0.12);
    expect(g.ceiling).toBe(0.12);
    expect(g.variance).toBeCloseTo(0);
    expect(g.label).toBe("Within baseline");
  });

  it("reports positive variance when over", () => {
    const g = gradeTicketLoad(735, 2450, { ticketsPer100: 14 });
    expect(g.per).toBeCloseTo(0.3);
    expect(g.variance).toBeCloseTo(0.16);
    expect(g).toMatchObject({ label: "Over baseline", tone: "bad" });
  });

  it("reports negative variance when under", () => {
    const g = gradeTicketLoad(8, 210, { ticketsPer100: 6 });
    expect(g.variance).toBeLessThan(0);
    expect(g.tone).toBe("good");
  });

  it("treats zero users as zero load", () => {
    expect(gradeTicketLoad(10, 0, { ticketsPer100: 12 }).per).toBe(0);
  });
});
