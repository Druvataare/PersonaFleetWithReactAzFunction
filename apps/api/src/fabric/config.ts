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

/** Reads the configuration, or throws naming exactly what is missing.
    Setting names avoid underscores and the word "Fabric" as a leading
    SCREAMING_SNAKE prefix: the portal's Environment variables blade for this
    Function App rejected FABRIC_SQL_ENDPOINT (confirmed 22 Sep 2026), most
    likely because this subscription has AI/Fabric-integration preview
    features enabled that reserve that naming pattern for their own
    connection settings. PascalCase side-steps it either way. */
export function readConfig(env: Record<string, string | undefined> = process.env): FabricConfig {
  const server = env.FabricSqlEndpoint?.trim();
  const database = env.FabricSqlDatabase?.trim();
  const missing = [...(server ? [] : ["FabricSqlEndpoint"]), ...(database ? [] : ["FabricSqlDatabase"])];
  if (!server || !database) throw new FabricNotConfiguredError(missing);
  return {
    server,
    database,
    connectTimeoutMs: number(env.FabricConnectTimeoutMs, 15_000),
    /* The SQL analytics endpoint is an analytics engine: a cold query can take
       seconds, but the portal should fail rather than hang (AD-8). */
    queryTimeoutMs: number(env.FabricQueryTimeoutMs, 20_000),
    poolMax: number(env.FabricPoolMax, 10),
  };
}

export const isConfigured = (env: Record<string, string | undefined> = process.env): boolean =>
  Boolean(env.FabricSqlEndpoint?.trim() && env.FabricSqlDatabase?.trim());
