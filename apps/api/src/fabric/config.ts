/* Where Fabric is and how long we wait for it. Everything comes from app
   settings — there is no connection string and no secret anywhere (AD-9). */

export interface FabricConfig {
  /** e.g. xxxxx.datawarehouse.fabric.microsoft.com */
  server: string;
  /** The lakehouse name as the SQL analytics endpoint sees it. */
  database: string;
  connectTimeoutMs: number;
  queryTimeoutMs: number;
  poolMax: number;
}

export class FabricNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Fabric is not configured: set ${missing.join(" and ")}`);
    this.name = "FabricNotConfiguredError";
  }
}

const number = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Reads the configuration, or throws naming exactly what is missing. */
export function readConfig(env: Record<string, string | undefined> = process.env): FabricConfig {
  const server = env.FABRIC_SQL_ENDPOINT?.trim();
  const database = env.FABRIC_SQL_DATABASE?.trim();
  const missing = [...(server ? [] : ["FABRIC_SQL_ENDPOINT"]), ...(database ? [] : ["FABRIC_SQL_DATABASE"])];
  if (!server || !database) throw new FabricNotConfiguredError(missing);
  return {
    server,
    database,
    connectTimeoutMs: number(env.FABRIC_CONNECT_TIMEOUT_MS, 15_000),
    /* The SQL analytics endpoint is an analytics engine: a cold query can take
       seconds, but the portal should fail rather than hang (AD-8). */
    queryTimeoutMs: number(env.FABRIC_QUERY_TIMEOUT_MS, 20_000),
    poolMax: number(env.FABRIC_POOL_MAX, 10),
  };
}

export const isConfigured = (env: Record<string, string | undefined> = process.env): boolean =>
  Boolean(env.FABRIC_SQL_ENDPOINT?.trim() && env.FABRIC_SQL_DATABASE?.trim());
