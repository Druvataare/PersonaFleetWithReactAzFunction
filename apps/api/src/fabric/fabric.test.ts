import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FabricNotConfiguredError, isConfigured, readConfig, type FabricConfig } from "./config.ts";
import { checkFabric } from "./freshness.ts";
import {
  getPool,
  resetPool,
  type SqlDriver,
  type SqlPool,
  type SqlRequest,
  type TokenSource,
} from "./pool.ts";
import { query, QueryFailedError, RowShapeError } from "./query.ts";

const config: FabricConfig = {
  server: "x.datawarehouse.fabric.microsoft.com",
  database: "Lake",
  connectTimeoutMs: 1000,
  queryTimeoutMs: 1000,
  poolMax: 2,
};

/** A fake driver whose queries are answered from a script, one entry per call. */
function fakeDriver(script: Array<unknown[] | Error>) {
  const seen: Array<{ text: string; params: Record<string, unknown> }> = [];
  let connects = 0;
  let closes = 0;
  let step = 0;
  const driver: SqlDriver = {
    async connect() {
      connects++;
      const pool: SqlPool = {
        request() {
          const params: Record<string, unknown> = {};
          const request: SqlRequest = {
            input(name, value) {
              params[name] = value;
              return request;
            },
            async query<T>(text: string) {
              seen.push({ text, params });
              const next = script[Math.min(step++, script.length - 1)];
              if (next instanceof Error) throw next;
              return { recordset: next as T[] };
            },
          };
          return request;
        },
        async close() {
          closes++;
        },
      };
      return pool;
    },
  };
  return { driver, seen, connects: () => connects, closes: () => closes };
}

const tokens = (expiresIn = 3_600_000): TokenSource => ({
  getToken: async () => ({ token: "t", expiresOnTimestamp: Date.now() + expiresIn }),
});

const schema = z.object({ id: z.string(), n: z.number() });
const transient = Object.assign(new Error("socket closed"), { code: "ESOCKET" });

/* Called, not passed: beforeEach hands its callback a test-context object,
   which resetPool would read as the pool to drop. */
beforeEach(() => resetPool());
afterEach(() => vi.useRealTimers());

describe("configuration", () => {
  it("reads settings and applies defaults", () => {
    const c = readConfig({ FabricSqlEndpoint: " a.b ", FabricSqlDatabase: "Db" });
    expect(c).toMatchObject({ server: "a.b", database: "Db", queryTimeoutMs: 20_000, poolMax: 10 });
  });

  it("names exactly what is missing", () => {
    expect(() => readConfig({})).toThrow("set FabricSqlEndpoint and FabricSqlDatabase");
    expect(() => readConfig({ FabricSqlEndpoint: "a" })).toThrow("set FabricSqlDatabase");
    expect(() => readConfig({})).toThrow(FabricNotConfiguredError);
    expect(isConfigured({ FabricSqlEndpoint: "a", FabricSqlDatabase: "b" })).toBe(true);
    expect(isConfigured({})).toBe(false);
  });

  it("ignores nonsense timeout overrides", () => {
    const c = readConfig({
      FabricSqlEndpoint: "a",
      FabricSqlDatabase: "b",
      FabricQueryTimeoutMs: "-5",
    });
    expect(c.queryTimeoutMs).toBe(20_000);
  });
});

describe("pool", () => {
  it("shares one connection between concurrent cold-start requests", async () => {
    const fake = fakeDriver([[]]);
    await Promise.all([1, 2, 3].map(() => getPool(config, fake.driver, tokens())));
    expect(fake.connects()).toBe(1);
  });

  it("reconnects, and closes the old pool, once the token is near expiry", async () => {
    const fake = fakeDriver([[]]);
    await getPool(config, fake.driver, tokens(4 * 60_000)); // inside the 5-minute refresh margin
    await getPool(config, fake.driver, tokens());
    expect(fake.connects()).toBe(2);
    expect(fake.closes()).toBe(1);
  });
});

describe("query", () => {
  it("passes values as parameters and returns validated rows", async () => {
    const fake = fakeDriver([[{ id: "a", n: 1 }]]);
    const result = await query(
      { name: "t", sql: "SELECT id, n FROM v WHERE id = @id", params: { id: "a" }, schema },
      { config, driver: fake.driver, tokens: tokens() },
    );
    expect(result.rows).toEqual([{ id: "a", n: 1 }]);
    expect(fake.seen[0]).toEqual({ text: "SELECT id, n FROM v WHERE id = @id", params: { id: "a" } });
  });

  it("retries a transient fault with a fresh connection, then succeeds", async () => {
    const fake = fakeDriver([transient, [{ id: "a", n: 1 }]]);
    const log = vi.fn();
    const result = await query(
      { name: "t", sql: "s", schema },
      { config, driver: fake.driver, tokens: tokens(), log, backoffMs: [0, 0] },
    );
    expect(result.rows).toHaveLength(1);
    expect(fake.connects()).toBe(2);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("retrying"));
  });

  it("gives up after the last retry and says how many attempts were made", async () => {
    const fake = fakeDriver([transient]);
    const failure = query(
      { name: "t", sql: "s", schema },
      { config, driver: fake.driver, tokens: tokens(), backoffMs: [0, 0] },
    );
    await expect(failure).rejects.toThrow(QueryFailedError);
    await expect(failure).rejects.toThrow('"t" failed after 3 attempt(s)');
  });

  it("does not retry a permanent fault such as a missing grant", async () => {
    const denied = Object.assign(new Error("The SELECT permission was denied"), { number: 229 });
    const fake = fakeDriver([denied]);
    await expect(
      query(
        { name: "t", sql: "s", schema },
        { config, driver: fake.driver, tokens: tokens(), backoffMs: [0, 0] },
      ),
    ).rejects.toThrow("failed after 3 attempt(s): The SELECT permission was denied");
    expect(fake.seen).toHaveLength(1);
  });

  it("fails loudly, naming the field, when a column is missing or renamed (AD-18)", async () => {
    const fake = fakeDriver([[{ id: "a", count: 1 }]]);
    const failure = query(
      { name: "devices", sql: "s", schema },
      { config, driver: fake.driver, tokens: tokens() },
    );
    await expect(failure).rejects.toThrow(RowShapeError);
    await expect(failure).rejects.toThrow('"devices" returned unexpected rows: row 0: n');
    expect(fake.seen).toHaveLength(1); // a shape error is not retried
  });
});

describe("checkFabric", () => {
  it("reports unconfigured without touching the network", async () => {
    const status = await checkFabric({}, {});
    expect(status).toEqual({
      ok: false,
      detail: "not configured — set FabricSqlEndpoint and FabricSqlDatabase",
    });
  });

  it("reports the round trip and the data's date when Fabric answers", async () => {
    const fake = fakeDriver([
      [{ asOfDate: "2026-09-09T00:00:00Z", personaSnapshotDate: "2026-09-18T00:00:00Z" }],
    ]);
    const status = await checkFabric(
      { config, driver: fake.driver, tokens: tokens() },
      { FabricSqlEndpoint: "a", FabricSqlDatabase: "b" },
    );
    expect(status.ok).toBe(true);
    expect(status.detail).toMatch(/^connected in \d+ms, data as of 2026-09-09$/);
  });

  it("turns a failure into a report instead of throwing", async () => {
    const fake = fakeDriver([new Error("Login failed for user")]);
    const status = await checkFabric(
      { config, driver: fake.driver, tokens: tokens(), backoffMs: [] },
      { FabricSqlEndpoint: "a", FabricSqlDatabase: "b" },
    );
    expect(status.ok).toBe(false);
    expect(status.detail).toContain("Login failed for user");
  });
});
