/* The Fabric connection: one pool per process, authenticated with a token
   rather than a password (AD-9). DefaultAzureCredential uses the Function
   App's managed identity in Azure and the developer's `az login` locally. */
import { DefaultAzureCredential } from "@azure/identity";
import sql from "mssql";
import { readConfig, type FabricConfig } from "./config.ts";

/** The slice of the driver we use, so tests can supply their own. */
export interface SqlRequest {
  input(name: string, value: unknown): SqlRequest;
  query<T>(text: string): Promise<{ recordset: T[] }>;
}
export interface SqlPool {
  request(): SqlRequest;
  close(): Promise<void>;
}
export interface SqlDriver {
  connect(config: FabricConfig, token: string): Promise<SqlPool>;
}
export interface TokenSource {
  getToken(): Promise<{ token: string; expiresOnTimestamp: number }>;
}

/** Tokens are refreshed this long before they expire, so no request races the clock. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const SQL_SCOPE = "https://database.windows.net/.default";

export const defaultTokenSource: TokenSource = {
  async getToken() {
    const token = await new DefaultAzureCredential().getToken(SQL_SCOPE);
    if (!token) throw new Error("No Entra token for Fabric: check the managed identity, or run `az login`");
    return token;
  },
};

export const defaultDriver: SqlDriver = {
  async connect(config, token) {
    const pool = new sql.ConnectionPool({
      server: config.server,
      database: config.database,
      authentication: { type: "azure-active-directory-access-token", options: { token } },
      options: { encrypt: true, trustServerCertificate: false },
      connectionTimeout: config.connectTimeoutMs,
      requestTimeout: config.queryTimeoutMs,
      pool: { max: config.poolMax, min: 0, idleTimeoutMillis: 30_000 },
    });
    await pool.connect();
    return pool as unknown as SqlPool;
  },
};

/* One pool per database, not one per process: the API reads the lakehouse and
   the configuration store in the same request (AD-4), and they are different
   servers with different tokens. Keyed by server and database so adding a
   third store needs no change here. */
const keyOf = (config: FabricConfig) => `${config.server}/${config.database}`;

const live = new Map<string, { pool: SqlPool; expiresAt: number }>();
const pending = new Map<string, Promise<SqlPool>>();

/** The pool for this database, reconnecting when the token is close to expiry. */
export async function getPool(
  config: FabricConfig = readConfig(),
  driver: SqlDriver = defaultDriver,
  tokens: TokenSource = defaultTokenSource,
): Promise<SqlPool> {
  const key = keyOf(config);
  const existing = live.get(key);
  if (existing && Date.now() < existing.expiresAt - REFRESH_MARGIN_MS) return existing.pool;

  /* Several requests can arrive during a cold start; they share one connect. */
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const connect = (async () => {
    const previous = live.get(key);
    const { token, expiresOnTimestamp } = await tokens.getToken();
    const pool = await driver.connect(config, token);
    live.set(key, { pool, expiresAt: expiresOnTimestamp });
    if (previous) await previous.pool.close().catch(() => {});
    return pool;
  })().finally(() => {
    pending.delete(key);
  });
  pending.set(key, connect);
  return connect;
}

/** Drops pools; used when a connection fails and by tests. With no argument,
    drops every pool — a failed query should only reset the database it was
    using, so callers that know which one pass it. */
export async function resetPool(config?: FabricConfig): Promise<void> {
  const keys = config ? [keyOf(config)] : [...live.keys()];
  const closing: Array<Promise<void>> = [];
  for (const key of keys) {
    const previous = live.get(key);
    live.delete(key);
    pending.delete(key);
    if (previous) closing.push(previous.pool.close().catch(() => {}));
  }
  await Promise.all(closing);
}
