import type { HttpRequest } from "@azure/functions";
import { afterEach, describe, expect, it } from "vitest";
import type { FabricConfig } from "../fabric/config.ts";
import { resetPool, type SqlDriver, type SqlPool, type SqlRequest, type TokenSource } from "../fabric/pool.ts";
import { callerFrom, NotAuthenticatedError } from "./identity.ts";
import { readExceptions, readMigrations, readPersonaChanges } from "./reads.ts";
import { applyPersonaChange, BadRequestError, idempotencyKey, raiseProvisioningRequest } from "./writes.ts";

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
const caller = { name: "ada@example.com", id: "swa-user-1" };

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

const deps = (routes: Array<{ match: string; rows: unknown[] }>) => {
  const { driver, asked } = fakeDriver(routes);
  return { deps: { config, driver, tokens }, asked };
};

/** A request carrying only what these handlers read. */
const req = (headers: Record<string, string> = {}): HttpRequest =>
  ({
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  }) as unknown as HttpRequest;

const device = { id: "d1", userId: "u1", user: "Ada Lovelace", personaId: "KW" };
const personas = [
  { id: "KW", name: "Knowledge Worker", sub: "Corporate", count: 1542, hue: "#2FA9C9" },
  { id: "DEV", name: "Engineering", sub: "Software", count: 546, hue: "#6E7BF2" },
];
const storedChange = {
  date: "2026-09-24 09:15",
  id: "d1",
  user: "Ada Lovelace",
  from: "KW",
  to: "DEV",
};

const writeRoutes = (over: Array<{ match: string; rows: unknown[] }> = []) => [
  { match: "persona_vw_api_v1_device", rows: [device] },
  { match: "persona_vw_api_v1_persona\n", rows: personas },
  { match: "INSERT INTO dbo.persona_change", rows: [storedChange] },
  ...over,
];

afterEach(async () => {
  await resetPool();
});

describe("identity", () => {
  const principal = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");

  it("reads the caller from the Static Web Apps header", () => {
    const c = callerFrom(req({ "x-ms-client-principal": principal({ userDetails: "ada@x.com", userId: "u9" }) }));
    expect(c).toEqual({ name: "ada@x.com", id: "u9" });
  });

  it("refuses a request with no header, rather than inventing a caller", () => {
    expect(() => callerFrom(req())).toThrow(NotAuthenticatedError);
  });

  it("treats a malformed or nameless principal as not authenticated", () => {
    expect(() => callerFrom(req({ "x-ms-client-principal": "not-base64-json" }))).toThrow(NotAuthenticatedError);
    expect(() => callerFrom(req({ "x-ms-client-principal": principal({ userId: "u9" }) }))).toThrow(
      NotAuthenticatedError,
    );
  });
});

describe("idempotency key", () => {
  it("is the same for the same request inside the window", () => {
    const at = 1_700_000_000_000;
    const a = idempotencyKey(req(), ["persona-change", "u1", "d1", "DEV"], at);
    const b = idempotencyKey(req(), ["persona-change", "u1", "d1", "DEV"], at + 5_000);
    expect(a).toBe(b);
  });

  it("differs once the window has passed, so a later genuine repeat is not swallowed", () => {
    const at = 1_700_000_000_000;
    const a = idempotencyKey(req(), ["persona-change", "u1", "d1", "DEV"], at);
    const b = idempotencyKey(req(), ["persona-change", "u1", "d1", "DEV"], at + 120_000);
    expect(a).not.toBe(b);
  });

  it("differs by caller and by content", () => {
    const at = 1_700_000_000_000;
    const base = idempotencyKey(req(), ["persona-change", "u1", "d1", "DEV"], at);
    expect(idempotencyKey(req(), ["persona-change", "u2", "d1", "DEV"], at)).not.toBe(base);
    expect(idempotencyKey(req(), ["persona-change", "u1", "d1", "EXEC"], at)).not.toBe(base);
  });

  it("prefers a key the client supplied", () => {
    const key = idempotencyKey(req({ "idempotency-key": "client-key-1" }), ["ignored"], 0);
    expect(key).toBe("client-key-1");
  });
});

describe("persona change", () => {
  it("records the caller from their identity, never from the body", async () => {
    const { deps: d, asked } = deps(writeRoutes());
    await applyPersonaChange({ userId: "d1", to: "DEV" }, caller, "k1", d);

    const insert = asked.find((a) => a.text.includes("INSERT INTO dbo.persona_change"));
    expect(insert?.params.by).toBe("ada@example.com");
    /* The owner comes from the device, not from anything the client sent. */
    expect(insert?.params.userId).toBe("u1");
    expect(insert?.params.userName).toBe("Ada Lovelace");
    expect(insert?.params.fromPersona).toBe("KW");
  });

  it("returns the stored row, not the one we meant to write", async () => {
    /* The point of idempotency: on a second submit the insert is swallowed
       and this read-back is the original record. */
    const { deps: d } = deps(writeRoutes());
    const change = await applyPersonaChange({ userId: "d1", to: "DEV" }, caller, "k1", d);
    expect(change).toEqual(storedChange);
  });

  it("swallows only a duplicate key, and rethrows anything else", async () => {
    const { deps: d, asked } = deps(writeRoutes());
    await applyPersonaChange({ userId: "d1", to: "DEV" }, caller, "k1", d);

    const sql = asked.find((a) => a.text.includes("INSERT INTO dbo.persona_change"))!.text;
    expect(sql).toContain("ERROR_NUMBER() NOT IN (2601, 2627) THROW");
    expect(sql).toContain("WHERE IdempotencyKey = @key");
  });

  it("rejects a missing body", async () => {
    const { deps: d } = deps(writeRoutes());
    await expect(applyPersonaChange(null, caller, "k1", d)).rejects.toThrow(BadRequestError);
    await expect(applyPersonaChange({ userId: "d1" }, caller, "k1", d)).rejects.toThrow(/required/);
  });

  it("rejects an unknown persona", async () => {
    const { deps: d } = deps(writeRoutes());
    await expect(applyPersonaChange({ userId: "d1", to: "NOPE" }, caller, "k1", d)).rejects.toThrow(
      /Unknown persona NOPE/,
    );
  });

  it("rejects a move to the persona the user is already in", async () => {
    const { deps: d } = deps(writeRoutes());
    await expect(applyPersonaChange({ userId: "d1", to: "KW" }, caller, "k1", d)).rejects.toThrow(
      /already in Knowledge Worker/,
    );
  });

  it("answers 404 for a device that does not exist", async () => {
    const { deps: d } = deps([
      { match: "persona_vw_api_v1_device", rows: [] },
      { match: "persona_vw_api_v1_persona\n", rows: personas },
    ]);
    await expect(applyPersonaChange({ userId: "ghost", to: "DEV" }, caller, "k1", d)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("provisioning request", () => {
  it("returns the database's request number and records the caller", async () => {
    const { deps: d, asked } = deps([
      { match: "persona_vw_api_v1_device", rows: [device] },
      {
        match: "INSERT INTO dbo.persona_provisioning_request",
        rows: [{ number: "REQ0000001", group: "EUC-Provisioning" }],
      },
    ]);
    const result = await raiseProvisioningRequest("d1", caller, "k1", d);

    expect(result).toEqual({ number: "REQ0000001", group: "EUC-Provisioning" });
    const insert = asked.find((a) => a.text.includes("INSERT INTO dbo.persona_provisioning_request"));
    expect(insert?.params.by).toBe("ada@example.com");
  });

  it("answers 404 for a device that does not exist", async () => {
    const { deps: d } = deps([{ match: "persona_vw_api_v1_device", rows: [] }]);
    await expect(raiseProvisioningRequest("ghost", caller, "k1", d)).rejects.toMatchObject({ status: 404 });
  });
});

describe("reads", () => {
  it("reads migrations from the lakehouse, where they lag a pipeline run behind", async () => {
    const { deps: d, asked } = deps([
      { match: "persona_vw_api_v1_migration", rows: [{ from: "KW", to: "DEV", people: 3 }] },
    ]);
    const rows = await readMigrations(d);

    expect(rows).toEqual([{ from: "KW", to: "DEV", people: 3 }]);
    expect(asked[0].text).toContain("persona_vw_api_v1_migration");
  });

  it("formats the change log date as the mock does, so both read alike", async () => {
    const { deps: d, asked } = deps([{ match: "dbo.persona_change", rows: [storedChange] }]);
    const rows = await readPersonaChanges(d);

    expect(rows[0].date).toBe("2026-09-24 09:15");
    expect(asked[0].text).toContain("CONVERT(varchar(16), RequestedUtc, 120)");
  });

  it("reports how many days ago an exception was raised", async () => {
    const { deps: d, asked } = deps([
      {
        match: "dbo.persona_app_exception",
        rows: [
          {
            id: "e1",
            user: "u1",
            persona: "KW",
            app: "Visual Studio Code",
            reason: "Needs it for a project",
            state: "Pending",
            raised: 4,
          },
        ],
      },
    ]);
    const rows = await readExceptions(d);

    expect(rows[0].raised).toBe(4);
    expect(asked[0].text).toContain("DATEDIFF(day, RaisedUtc, SYSUTCDATETIME())");
  });
});
