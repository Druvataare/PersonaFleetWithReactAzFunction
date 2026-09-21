/* Exercises every mock endpoint over HTTP through the shared test server. */
import { describe, expect, it } from "vitest";
import { apiGet, apiPost, ApiRequestError } from "../api/client.ts";
import type {
  BaselinesResponse,
  CatalogResponse,
  DevicesResponse,
  ExceptionsResponse,
  MappingReviewResponse,
  MappingSummary,
  MigrationsResponse,
  PersonaChangeResponse,
  PersonaChangesResponse,
  PersonasResponse,
  ProvisioningRequestResponse,
  TicketSummary,
} from "@pfc/contract";

describe("read endpoints", () => {
  it("GET /api/personas", async () => {
    const personas = await apiGet<PersonasResponse>("/api/personas");
    expect(personas).toHaveLength(7);
    expect(personas[0]).toEqual({
      id: "DEV",
      name: "Engineering",
      sub: "Software & platform build",
      count: 1840,
      hue: "#6E7BF2",
    });
  });

  it("GET /api/baselines", async () => {
    const b = await apiGet<BaselinesResponse>("/api/baselines");
    expect(b.defaults.DS.ramGB).toBe(64);
    expect(b.weights.FIELD.exp).toBe(30);
  });

  it("GET /api/catalog", async () => {
    const c = await apiGet<CatalogResponse>("/api/catalog");
    expect(c.apps.KW).toContain("Microsoft 365 Apps");
    expect(c.tasksAutomated.DS).toBe(16);
    expect(c.onboardingDays.FIELD).toBe(4);
    expect(c.ticketCategories).toHaveLength(6);
    expect(c.catalogItems).toHaveLength(8);
  });

  it("GET /api/fleet/devices", async () => {
    const d = await apiGet<DevicesResponse>("/api/fleet/devices");
    expect(Object.values(d).flat()).toHaveLength(182);
    expect(d.KW[0].id).toBe("KW-0001");
  });

  it("GET /api/mapping/summary with and without a persona", async () => {
    const all = await apiGet<MappingSummary>("/api/mapping/summary");
    expect(all.titlesMapped).toBe(12095);
    const cc = await apiGet<MappingSummary>("/api/mapping/summary?persona=CC");
    expect(cc.titlesMapped).toBe(2450);
    expect(cc.bands).toEqual({ "100": 2356, "50": 48, low: 46 });
  });

  it("GET /api/mapping/review filters by band and search", async () => {
    const low = await apiGet<MappingReviewResponse>("/api/mapping/review?band=low");
    expect(low.matched).toBe(101);
    expect(low.rows.every((r) => r.conf < 50)).toBe(true);
    const all = await apiGet<MappingReviewResponse>("/api/mapping/review");
    expect(all.matched).toBe(204);
    expect(all.rows).toHaveLength(150);
    const search = await apiGet<MappingReviewResponse>("/api/mapping/review?q=finance");
    expect(search.rows.every((r) => r.dept === "Finance")).toBe(true);
  });

  it("GET /api/tickets/summary for incidents and requests", async () => {
    const inc = await apiGet<TicketSummary>("/api/tickets/summary?type=inc");
    expect(inc.total).toBe(2063);
    const req = await apiGet<TicketSummary>("/api/tickets/summary?type=req");
    expect(req).toMatchObject({ kind: "req", total: 1438, uniqueRequestors: 1296, open: 485 });
    expect(req.byCategory[0]).toEqual({ k: "Laptop Request", n: 208 });
    const filtered = await apiGet<TicketSummary>("/api/tickets/summary?type=inc&persona=FIELD&cat=Hardware");
    expect(filtered.byCategory).toHaveLength(1);
    expect(filtered.perPersona.find((p) => p.id === "FIELD")?.tickets).toBe(412);
  });

  it("GET /api/tickets/summary defaults to incidents and rejects an unknown type", async () => {
    expect((await apiGet<TicketSummary>("/api/tickets/summary")).kind).toBe("inc");
    await expect(apiGet("/api/tickets/summary?type=bogus")).rejects.toMatchObject({ status: 400 });
  });

  it("GET /api/change/migrations and /api/change/exceptions", async () => {
    const m = await apiGet<MigrationsResponse>("/api/change/migrations");
    expect(m.reduce((a, x) => a + x.people, 0)).toBe(468);
    const e = await apiGet<ExceptionsResponse>("/api/change/exceptions");
    expect(e).toHaveLength(56);
  });

  it("GET /api/persona-changes starts empty", async () => {
    expect(await apiGet<PersonaChangesResponse>("/api/persona-changes")).toEqual([]);
  });
});

describe("POST /api/persona-changes", () => {
  it("moves a user and updates headcounts, migrations and the change log", async () => {
    const { change } = await apiPost<PersonaChangeResponse>("/api/persona-changes", {
      userId: "KW-0001",
      to: "DS",
    });
    expect(change).toMatchObject({ id: "KW-0001", from: "KW", to: "DS" });
    expect(change.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const personas = await apiGet<PersonasResponse>("/api/personas");
    expect(personas.find((p) => p.id === "KW")?.count).toBe(6119);
    expect(personas.find((p) => p.id === "DS")?.count).toBe(341);

    const devices = await apiGet<DevicesResponse>("/api/fleet/devices");
    expect(devices.KW.some((d) => d.id === "KW-0001")).toBe(false);
    expect(devices.DS.some((d) => d.id === "KW-0001")).toBe(true);

    const migrations = await apiGet<MigrationsResponse>("/api/change/migrations");
    expect(migrations.find((m) => m.from === "KW" && m.to === "DS")?.people).toBe(149);

    const log = await apiGet<PersonaChangesResponse>("/api/persona-changes");
    expect(log).toEqual([change]);
  });

  it("adds a new migration row for a route nobody has taken yet", async () => {
    await apiPost("/api/persona-changes", { userId: "EXEC-0001", to: "CC" });
    const migrations = await apiGet<MigrationsResponse>("/api/change/migrations");
    expect(migrations.at(-1)).toEqual({ from: "EXEC", to: "CC", people: 1 });
  });

  it("logs newest changes first", async () => {
    await apiPost("/api/persona-changes", { userId: "DEV-0001", to: "KW" });
    await apiPost("/api/persona-changes", { userId: "DEV-0002", to: "KW" });
    const log = await apiGet<PersonaChangesResponse>("/api/persona-changes");
    expect(log.map((c) => c.id)).toEqual(["DEV-0002", "DEV-0001"]);
  });

  it.each([
    [{}, 400, "userId and to are required"],
    [{ userId: "KW-0001", to: "NOPE" }, 400, "Unknown persona NOPE"],
    [{ userId: "NOPE-0001", to: "DS" }, 404, "User NOPE-0001 not found"],
    [{ userId: "KW-0001", to: "KW" }, 400, "User is already in Knowledge Worker"],
  ])("rejects %j with %i", async (body, status, message) => {
    const err = await apiPost("/api/persona-changes", body).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status, message });
  });
});

describe("POST /api/devices/:did/provisioning-requests", () => {
  it("returns a ticket number routed to EUC-Provisioning", async () => {
    const res = await apiPost<ProvisioningRequestResponse>("/api/devices/CC-0003/provisioning-requests");
    expect(res.number).toMatch(/^INC00(5[0-8]\d{3})$/);
    expect(res.group).toBe("EUC-Provisioning");
  });

  it("returns 404 for an unknown device", async () => {
    await expect(apiPost("/api/devices/NOPE/provisioning-requests")).rejects.toMatchObject({ status: 404 });
  });
});
