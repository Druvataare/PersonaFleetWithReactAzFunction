// @vitest-environment node
import type { PersonaDef } from "@pfc/scoring";
import { describe, expect, it } from "vitest";
import {
  ageByPriority,
  type FleetTicket,
  mappingReview,
  mappingSummary,
  REVIEW_LIMIT,
  tally,
  ticketSummary,
  type TitleRow,
} from "@pfc/contract";
import { generateFleetData } from "./data/generate.ts";

const personas: PersonaDef[] = [
  { id: "DEV", name: "Engineering", sub: "", count: 3, hue: "#000" },
  { id: "KW", name: "Knowledge Worker", sub: "", count: 2, hue: "#111" },
  { id: "CC", name: "Contact Centre", sub: "", count: 0, hue: "#222" },
];

const title = (t: string, dept: string, pid: string, conf: number): TitleRow => ({
  t,
  dept,
  pid,
  conf,
  why: "",
});
const titles: TitleRow[] = [
  title("Engineer", "Platform", "DEV", 100),
  title("Engineer", "DevOps", "DEV", 40),
  title("Analyst", "Finance", "KW", 75),
  title("Engineer", "Platform", "DEV", 100),
  title("Analyst", "Legal", "KW", 12),
];

describe("tally", () => {
  it("counts by key, highest first, keeping first-seen order for ties", () => {
    expect(tally(["b", "a", "b", "c", "a"], (x) => x)).toEqual([
      { k: "b", n: 2 },
      { k: "a", n: 2 },
      { k: "c", n: 1 },
    ]);
  });
});

describe("mappingSummary", () => {
  it("summarises all personas", () => {
    const s = mappingSummary(titles, personas, "all");
    expect(s.titlesMapped).toBe(5);
    expect(s.avgConfidence).toBeCloseTo(65.4);
    expect(s.distinctTitles).toBe(2);
    expect(s.bands).toEqual({ "100": 2, "50": 1, low: 2 });
    expect(s.byPersona).toEqual([
      { k: "DEV", n: 3 },
      { k: "KW", n: 2 },
    ]);
    // DEV: Platform|Engineer, DevOps|Engineer · KW: Finance|Analyst, Legal|Analyst
    expect(s.byDept).toEqual([
      { k: "DEV", n: 2 },
      { k: "KW", n: 2 },
    ]);
  });

  it("scopes to one persona", () => {
    const s = mappingSummary(titles, personas, "KW");
    expect(s.titlesMapped).toBe(2);
    expect(s.byPersona).toEqual([{ k: "KW", n: 2 }]);
  });

  it("returns zeros for an empty scope", () => {
    expect(mappingSummary(titles, personas, "CC")).toMatchObject({
      avgConfidence: 0,
      titlesMapped: 0,
      byPersona: [],
    });
  });

  it("matches the wireframe's headline numbers on the sample data", () => {
    const data = generateFleetData();
    const s = mappingSummary(data.titleRows, data.personas, null);
    expect(s.avgConfidence.toFixed(2)).toBe("99.20");
    expect(s.distinctTitles).toBe(2671);
    expect(s.bands).toEqual({ "100": 11891, "50": 103, low: 101 });
  });
});

describe("mappingReview", () => {
  it("lists everything under 100% by default, lowest first", () => {
    expect(mappingReview(titles, null, null, null).rows.map((r) => r.conf)).toEqual([12, 40, 75]);
  });

  it("filters by confidence band", () => {
    expect(mappingReview(titles, null, "100", null).rows).toHaveLength(2);
    expect(mappingReview(titles, null, "low", null).rows.map((r) => r.conf)).toEqual([12, 40]);
  });

  it("ignores an unknown band value", () => {
    expect(mappingReview(titles, null, "bogus", null).rows).toHaveLength(3);
  });

  it("searches title and department case-insensitively", () => {
    expect(mappingReview(titles, null, null, "fin").rows.map((r) => r.dept)).toEqual(["Finance"]);
    expect(mappingReview(titles, null, null, "ANALYST").rows).toHaveLength(2);
  });

  it("scopes to a persona", () => {
    expect(mappingReview(titles, "DEV", null, null).rows.map((r) => r.conf)).toEqual([40]);
  });

  it(`limits to ${REVIEW_LIMIT} rows but reports the full match count`, () => {
    const many = Array.from({ length: 400 }, (_, i) => title(`T${i}`, "D", "DEV", i % 100));
    const res = mappingReview(many, null, null, null);
    expect(res.rows).toHaveLength(REVIEW_LIMIT);
    expect(res.matched).toBe(400);
  });
});

const ticket = (over: Partial<FleetTicket>): FleetTicket => ({
  id: "INC0041000",
  pid: "DEV",
  uid: "DEV-U1",
  dept: "DevOps",
  cat: "Performance",
  short: "",
  priority: "P3",
  state: "New",
  open: true,
  group: "EUC-Desktop",
  ageDays: 0,
  week: 0,
  sla: false,
  ...over,
});

describe("ageByPriority", () => {
  it("buckets by age and priority, including the bucket edges", () => {
    const buckets = ageByPriority([
      ticket({ ageDays: 0, priority: "P1" }),
      ticket({ ageDays: 7, priority: "P2" }),
      ticket({ ageDays: 8, priority: "P2" }),
      ticket({ ageDays: 21, priority: "P4" }),
      ticket({ ageDays: 22, priority: "P3" }),
      ticket({ ageDays: 83, priority: "P3" }),
    ]);
    expect(buckets).toEqual([
      { label: "0-7", vals: [1, 1, 0, 0], total: 2 },
      { label: "8-14", vals: [0, 1, 0, 0], total: 1 },
      { label: "15-21", vals: [0, 0, 0, 1], total: 1 },
      { label: "22+", vals: [0, 0, 2, 0], total: 2 },
    ]);
  });
});

describe("ticketSummary", () => {
  const set = [
    ticket({ uid: "DEV-U1", cat: "Hardware", week: 0, open: true, sla: true }),
    ticket({ uid: "DEV-U1", cat: "Hardware", week: 11, open: false }),
    ticket({ uid: "DEV-U2", cat: "Access", week: 3, dept: "QA" }),
    ticket({ pid: "KW", uid: "KW-U1", cat: "Hardware", dept: "Finance", week: 5, open: false }),
  ];

  it("summarises the whole set", () => {
    const s = ticketSummary(set, personas, "inc", "all", null);
    expect(s).toMatchObject({ kind: "inc", total: 4, uniqueRequestors: 3, open: 2, slaBreached: 1 });
    expect(s.byCategory).toEqual([
      { k: "Hardware", n: 3 },
      { k: "Access", n: 1 },
    ]);
    expect(s.topDepartments[0]).toEqual({ k: "DevOps", n: 2 });
  });

  it("orders weeks oldest first", () => {
    const s = ticketSummary(set, personas, "inc", null, null);
    expect(s.weeks).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
  });

  it("filters by persona and category but keeps per-persona totals for the whole set", () => {
    const s = ticketSummary(set, personas, "inc", "DEV", "Hardware");
    expect(s.total).toBe(2);
    expect(s.byCategory).toEqual([{ k: "Hardware", n: 2 }]);
    expect(s.perPersona).toEqual([
      { id: "DEV", tickets: 3, open: 2, sla: 1 },
      { id: "KW", tickets: 1, open: 0, sla: 0 },
      { id: "CC", tickets: 0, open: 0, sla: 0 },
    ]);
  });

  it("matches the wireframe's incident headline numbers on the sample data", () => {
    const data = generateFleetData();
    const s = ticketSummary(data.incidents, data.personas, "inc", null, null);
    expect(s).toMatchObject({ total: 2063, uniqueRequestors: 1744, open: 1169, slaBreached: 940 });
    expect(s.byCategory[0]).toEqual({ k: "Connectivity", n: 374 });
    expect(s.perPersona.map((p) => p.tickets)).toEqual([184, 673, 735, 412, 8, 31, 20]);
    expect(s.weeks).toEqual([179, 157, 175, 176, 171, 178, 187, 182, 158, 163, 178, 159]);
  });
});
