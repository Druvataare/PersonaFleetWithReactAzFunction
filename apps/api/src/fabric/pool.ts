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

let current: { pool: SqlPool; expiresAt: number; connecting?: never } | null = null;
let pending: Promise<SqlPool> | null = null;

/** The pool for this process, reconnecting when the token is close to expiry. */
export async function getPool(
  config: FabricConfig = readConfig(),
  driver: SqlDriver = defaultDriver,
  tokens: TokenSource = defaultTokenSource,
): Promise<SqlPool> {
  if (current && Date.now() < current.expiresAt - REFRESH_MARGIN_MS) return current.pool;
  /* Several requests can arrive during a cold start; they share one connect. */
  pending ??= (async () => {
    const previous = current;
    const { token, expiresOnTimestamp } = await tokens.getToken();
    const pool = await driver.connect(config, token);
    current = { pool, expiresAt: expiresOnTimestamp };
    if (previous) await previous.pool.close().catch(() => {});
    return pool;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Drops the pool; used when a connection fails and by tests. */
export async function resetPool(): Promise<void> {
  const previous = current;
  current = null;
  pending = null;
  if (previous) await previous.pool.close().catch(() => {});
}
