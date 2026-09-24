import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FabricConfig } from "../fabric/config.ts";
import { resetPool, type SqlDriver, type SqlPool, type SqlRequest, type TokenSource } from "../fabric/pool.ts";
import { readerHandler } from "../http.ts";
import { readBaselines, splitPolicy } from "./baselines.ts";
import { buildCatalog, readCatalog } from "./catalog.ts";
import { readPersonas } from "./personas.ts";

const lakehouse: FabricConfig = {
  server: "lake.datawarehouse.fabric.microsoft.com",
  database: "Lake",
  connectTimeoutMs: 1000,
  queryTimeoutMs: 1000,
  poolMax: 2,
};
const store: FabricConfig = { ...lakehouse, server: "cfg.database.fabric.microsoft.com", database: "Config" };

const tokens: TokenSource = {
  async getToken() {
    return { token: "t", expiresOnTimestamp: Date.now() + 3_600_000 };
  },
};

/** Answers each query from `script` in order, recording what it was asked. */
function fakeDriver(script: unknown[][]) {
  const asked: string[] = [];
  const databases: string[] = [];
  let step = 0;
  const driver: SqlDriver = {
    async connect(config) {
      databases.push(config.database);
      const pool: SqlPool = {
        request() {
          const request: SqlRequest = {
            input() {
              return request;
            },
            async query<T>(text: string) {
              asked.push(text);
              return { recordset: (script[Math.min(step++, script.length - 1)] ?? []) as T[] };
            },
          };
          return request;
        },
        async close() {},
      };
      return pool;
    },
  };
  return { driver, asked, databases };
}

afterEach(async () => {
  await resetPool();
});

describe("personas", () => {
  it("returns the contract shape, ordered by the view", async () => {
    const rows = [
      { id: "DEV", name: "Engineering", sub: "Software", count: 546, hue: "#6E7BF2" },
      { id: "KW", name: "Knowledge Worker", sub: "Corporate", count: 1542, hue: "#2FA9C9" },
    ];
    const { driver, asked } = fakeDriver([rows]);
    const personas = await readPersonas({ config: lakehouse, driver, tokens });

    expect(personas).toEqual(rows);
    expect(asked[0]).toContain("persona_vw_api_v1_persona");
    expect(asked[0]).toContain("ORDER BY sortOrder");
  });

  it("fails naming the field when the view renames a column", async () => {
    /* headcount instead of count: undefined would otherwise be drawn as a
       zero-size ring rather than reported. */
    const { driver } = fakeDriver([[{ id: "DEV", name: "E", sub: "S", headcount: 546, hue: "#000000" }]]);
    await expect(readPersonas({ config: lakehouse, driver, tokens, backoffMs: [] })).rejects.toThrow(/count/);
  });
});

describe("baselines", () => {
  const row = {
    id: "DEV",
    ramGB: 32,
    storageGB: 1024,
    cpuScore: 88,
    bootSec: 40,
    crashes: 2,
    freePct: 20,
    batteryPct: 75,
    ticketsPer100: 30,
    prov: 30,
    perf: 30,
    comp: 15,
    exp: 10,
    sup: 15,
  };

  it("splits one row into the baseline and the weights", () => {
    const { defaults, weights } = splitPolicy([row]);
    expect(defaults.DEV).toEqual({
      ramGB: 32,
      storageGB: 1024,
      cpuScore: 88,
      bootSec: 40,
      crashes: 2,
      freePct: 20,
      batteryPct: 75,
      ticketsPer100: 30,
    });
    expect(weights.DEV).toEqual({ prov: 30, perf: 30, comp: 15, exp: 10, sup: 15 });
    /* The invariant the database enforces; worth restating where it is used. */
    const total = Object.values(weights.DEV).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("reads the configuration store, not the lakehouse", async () => {
    const { driver, databases, asked } = fakeDriver([[row]]);
    await readBaselines({ config: store, driver, tokens });

    expect(databases).toEqual(["Config"]);
    expect(asked[0]).toContain("dbo.persona_policy");
  });
});

describe("catalog", () => {
  const personas = [
    { id: "DEV", tasksAutomated: 14, onboardingDays: 3 },
    { id: "EXEC", tasksAutomated: 5, onboardingDays: 2 },
  ];
  const apps = [
    { personaId: "DEV", app: "Visual Studio Code" },
    { personaId: "DEV", app: "Docker Desktop" },
  ];
  const categories = [
    { kind: "inc", name: "Performance" },
    { kind: "req", name: "Storage Upgrade" },
  ];

  it("folds three grains into one response", () => {
    const catalog = buildCatalog({ personas, apps, categories });

    expect(catalog.apps.DEV).toEqual(["Visual Studio Code", "Docker Desktop"]);
    expect(catalog.tasksAutomated).toEqual({ DEV: 14, EXEC: 5 });
    expect(catalog.onboardingDays).toEqual({ DEV: 3, EXEC: 2 });
    expect(catalog.ticketCategories).toEqual(["Performance"]);
    expect(catalog.catalogItems).toEqual(["Storage Upgrade"]);
  });

  it("gives a persona with no catalogue apps an empty list, not undefined", () => {
    expect(buildCatalog({ personas, apps, categories }).apps.EXEC).toEqual([]);
  });

  it("ignores an app for a persona the view does not list", () => {
    const stray = [...apps, { personaId: "GONE", app: "Orphan" }];
    const catalog = buildCatalog({ personas, apps: stray, categories });
    expect(Object.keys(catalog.apps).sort()).toEqual(["DEV", "EXEC"]);
  });

  it("asks all three views", async () => {
    const { driver, asked } = fakeDriver([personas, apps, categories]);
    await readCatalog({ config: lakehouse, driver, tokens });

    const text = asked.join(" ");
    expect(text).toContain("persona_vw_api_v1_persona\n");
    expect(text).toContain("persona_vw_api_v1_persona_app");
    expect(text).toContain("persona_vw_api_v1_ticket_category");
  });
});

describe("readerHandler", () => {
  const context = () =>
    ({ invocationId: "abc-123", error: vi.fn() }) as unknown as InvocationContext & { error: ReturnType<typeof vi.fn> };
  const request = {} as HttpRequest;

  it("returns the payload with a cache header", async () => {
    const response = await readerHandler("personas", async () => [{ id: "DEV" }])(request, context());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual([{ id: "DEV" }]);
    expect(response.headers).toMatchObject({ "Cache-Control": expect.stringContaining("max-age=") });
  });

  it("turns a failure into a clean 500 carrying the correlation id", async () => {
    const ctx = context();
    const boom = new Error("SELECT * FROM dbo.secret_table failed at line 42");
    const response = await readerHandler("personas", () => Promise.reject(boom))(request, ctx);

    expect(response.status).toBe(500);
    /* The caller learns nothing about the schema; the log gets everything. */
    const body = JSON.stringify(response.jsonBody);
    expect(body).toContain("abc-123");
    expect(body).not.toContain("secret_table");
    expect(ctx.error).toHaveBeenCalledWith("personas failed", boom);
  });
});
