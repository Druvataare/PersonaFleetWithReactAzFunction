/* Where our two databases are and how long we wait for them. Everything comes
   from app settings — there is no connection string and no secret anywhere
   (AD-9).

   Two, because the stores have different jobs (AD-4): the lakehouse SQL
   analytics endpoint is read-only analytics, and the SQL database holds the
   policy and writeback tables the portal changes. They are separate items in
   Fabric with separate connection strings, so each needs its own pair of
   settings. */

export interface FabricConfig {
  /** e.g. xxxxx.datawarehouse.fabric.microsoft.com */
  server: string;
  /** The item name as its SQL endpoint sees it. */
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

/* Setting names avoid underscores and a SCREAMING_SNAKE prefix: the portal's
   Environment variables blade for this Function App rejected
   FABRIC_SQL_ENDPOINT (confirmed 22 Sep 2026), most likely because this
   subscription has AI/Fabric-integration preview features enabled that
   reserve that naming pattern for their own connection settings. PascalCase
   side-steps it either way. */
function readConnection(
  env: Record<string, string | undefined>,
  serverKey: string,
  databaseKey: string,
  queryTimeoutDefault: number,
): FabricConfig {
  const server = env[serverKey]?.trim();
  const database = env[databaseKey]?.trim();
  const missing = [...(server ? [] : [serverKey]), ...(database ? [] : [databaseKey])];
  if (!server || !database) throw new FabricNotConfiguredError(missing);
  return {
    server,
    database,
    connectTimeoutMs: number(env.FabricConnectTimeoutMs, 15_000),
    queryTimeoutMs: number(env.FabricQueryTimeoutMs, queryTimeoutDefault),
    poolMax: number(env.FabricPoolMax, 10),
  };
}

/** The lakehouse SQL analytics endpoint: the gold views (AD-3). */
export function readConfig(env: Record<string, string | undefined> = process.env): FabricConfig {
  /* An analytics engine: a cold query can take seconds, but the portal should
     fail rather than hang (AD-8). */
  return readConnection(env, "FabricSqlEndpoint", "FabricSqlDatabase", 20_000);
}

/** The SQL database holding policy and writeback (AD-4, AD-5). */
export function readConfigStore(env: Record<string, string | undefined> = process.env): FabricConfig {
  /* Transactional rather than analytical, and every query here reads at most
     a handful of rows, so a slow answer means something is wrong rather than
     merely cold. */
  return readConnection(env, "ConfigSqlEndpoint", "ConfigSqlDatabase", 8_000);
}

export const isConfigured = (env: Record<string, string | undefined> = process.env): boolean =>
  Boolean(env.FabricSqlEndpoint?.trim() && env.FabricSqlDatabase?.trim());

export const isConfigStoreConfigured = (env: Record<string, string | undefined> = process.env): boolean =>
  Boolean(env.ConfigSqlEndpoint?.trim() && env.ConfigSqlDatabase?.trim());
