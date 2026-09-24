import { mappingReview, mappingSummary, REVIEW_LIMIT, ticketSummary } from "@pfc/contract";
import { afterEach, describe, expect, it } from "vitest";
import type { FabricConfig } from "../fabric/config.ts";
import { resetPool, type SqlDriver, type SqlPool, type SqlRequest, type TokenSource } from "../fabric/pool.ts";
import { readMappingReview, readMappingSummary } from "./mapping.ts";
import { readTickets } from "./rows.ts";
import { readTicketSummary, toKind } from "./tickets.ts";

const config: FabricConfig = {
  server: "lake.datawarehouse.fabric.microsoft.com",
  database: "Lake",
  connectTimeoutMs: 1000,
  queryTimeoutMs: 1000,
  poolMax: 2,
};
const tokens: TokenSource = {
  async getToken() {
    return { token: "t", expiresOnTimestamp: Date.now() + 3_600_000 };
  },
};

/* Matched on SQL text rather than call order: these endpoints issue their two
   reads through Promise.all, so which one reaches the driver first is not
   something a test should depend on. */
function fakeDriver(routes: Array<{ match: string; rows: unknown[] }>) {
  const asked: Array<{ text: string; params: Record<string, unknown> }> = [];
  const driver: SqlDriver = {
    async connect() {
      const pool: SqlPool = {
        request() {
          const params: Record<string, unknown> = {};
          const request: SqlRequest = {
            input(name, value) {
              params[name] = value;
              return request;
            },
            async query<T>(text: string) {
              asked.push({ text, params });
              const route = routes.find((r) => text.includes(r.match));
              if (!route) throw new Error(`no fake rows for: ${text}`);
              return { recordset: route.rows as T[] };
            },
          };
          return request;
        },
        async close() {},
      };
      return pool;
    },
  };
  return { driver, asked };
}

const personaRows = [
  { id: "DEV", name: "Engineering", sub: "Software", count: 546, hue: "#6E7BF2" },
  { id: "KW", name: "Knowledge Worker", sub: "Corporate", count: 1542, hue: "#2FA9C9" },
];

const title = (over: Partial<Record<string, unknown>> = {}) => ({
  t: "Engineer",
  dept: "IT",
  pid: "DEV",
  conf: 100,
  why: "",
  ...over,
});

const ticket = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "job-1",
  pid: "DEV",
  uid: "u1",
  dept: "IT",
  cat: "OneDrive sync",
  short: "Sync stalled",
  priority: "P3",
  state: "Failed",
  open: true,
  group: "EPFix",
  ageDays: 4,
  week: 0,
  sla: false,
  ...over,
});

const deps = (routes: Array<{ match: string; rows: unknown[] }>) => {
  const { driver, asked } = fakeDriver(routes);
  return { deps: { config, driver, tokens }, asked };
};

afterEach(async () => {
  await resetPool();
});

describe("tickets", () => {
  it("passes the kind as a parameter and never ships it back", async () => {
    /* The view exposes kind, but it is the filter, not a contract field. The
       row below carries it to prove it does not survive into the response. */
    const { deps: d, asked } = deps([
      { match: "persona_vw_api_v1_ticket", rows: [{ ...ticket(), kind: "req" }] },
    ]);
    const tickets = await readTickets("req", d);

    expect(asked[0].params).toEqual({ kind: "req" });
    expect(asked[0].text).not.toContain("SELECT id, kind");
    expect(tickets[0]).not.toHaveProperty("kind");
    expect(tickets[0].id).toBe("job-1");
  });

  it("does not filter by persona in SQL, because perPersona needs the whole set", async () => {
    const { deps: d, asked } = deps([{ match: "persona_vw_api_v1_ticket", rows: [ticket()] }]);
    await readTickets("inc", d);

    const sql = asked[0].text;
    expect(sql).toContain("WHERE kind = @kind");
    expect(sql).not.toContain("pid =");
  });

  it("reports every persona in perPersona even when filtered to one", async () => {
    const rows = [ticket(), ticket({ id: "job-2", pid: "KW", uid: "u2" })];
    const { deps: d } = deps([
      { match: "persona_vw_api_v1_ticket", rows },
      { match: "persona_vw_api_v1_persona", rows: personaRows },
    ]);
    const summary = await readTicketSummary("inc", "DEV", null, d);

    expect(summary.total).toBe(1);
    /* Filtered to Engineering, but both personas still reported. */
    expect(summary.perPersona.map((p) => p.id)).toEqual(["DEV", "KW"]);
    expect(summary.perPersona.find((p) => p.id === "KW")?.tickets).toBe(1);
  });

  it("treats anything but req as an incident", () => {
    expect(toKind("req")).toBe("req");
    expect(toKind("inc")).toBe("inc");
    expect(toKind(null)).toBe("inc");
    expect(toKind("nonsense")).toBe("inc");
  });

  it("matches the shared function exactly, so mock and live cannot disagree", async () => {
    const rows = [ticket(), ticket({ id: "job-2", pid: "KW", uid: "u2", cat: "Browser", week: 3 })];
    const { deps: d } = deps([
      { match: "persona_vw_api_v1_ticket", rows },
      { match: "persona_vw_api_v1_persona", rows: personaRows },
    ]);
    const fromApi = await readTicketSummary("inc", null, null, d);

    expect(fromApi).toEqual(ticketSummary(rows as never, personaRows, "inc", null, null));
  });
});

describe("mapping", () => {
  it("bands total the number of mapped titles", async () => {
    const rows = [title(), title({ t: "Analyst", conf: 60 }), title({ t: "Clerk", conf: 20 })];
    const { deps: d } = deps([
      { match: "persona_vw_api_v1_title_mapping", rows },
      { match: "persona_vw_api_v1_persona", rows: personaRows },
    ]);
    const summary = await readMappingSummary(null, d);

    const banded = summary.bands["100"] + summary.bands["50"] + summary.bands.low;
    expect(banded).toBe(summary.titlesMapped);
    expect(summary.titlesMapped).toBe(3);
  });

  it("matches the shared function exactly", async () => {
    const rows = [title(), title({ t: "Analyst", pid: "KW", conf: 60 })];
    const { deps: d } = deps([
      { match: "persona_vw_api_v1_title_mapping", rows },
      { match: "persona_vw_api_v1_persona", rows: personaRows },
    ]);
    const fromApi = await readMappingSummary("DEV", d);

    expect(fromApi).toEqual(mappingSummary(rows as never, personaRows, "DEV"));
  });

  it("caps the review queue at REVIEW_LIMIT while reporting how many matched", async () => {
    /* 200 titles below 100%, so the cap has to bite. */
    const rows = Array.from({ length: 200 }, (_, i) => title({ t: `Title ${i}`, conf: 40 }));
    const { deps: d } = deps([{ match: "persona_vw_api_v1_title_mapping", rows }]);
    const review = await readMappingReview(null, null, null, d);

    expect(review.rows).toHaveLength(REVIEW_LIMIT);
    expect(review.matched).toBe(200);
    expect(review).toEqual(mappingReview(rows as never, null, null, null));
  });

  it("leaves fully confident titles out of the review queue", async () => {
    const rows = [title({ conf: 100 }), title({ t: "Analyst", conf: 55 })];
    const { deps: d } = deps([{ match: "persona_vw_api_v1_title_mapping", rows }]);
    const review = await readMappingReview(null, null, null, d);

    expect(review.rows.map((r) => r.t)).toEqual(["Analyst"]);
  });
});
