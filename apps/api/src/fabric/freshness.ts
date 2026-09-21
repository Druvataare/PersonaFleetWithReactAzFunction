/* How fresh the data is, and — since it is the smallest possible read — the
   health check's proof that Fabric is reachable and the views are granted. */
import { z } from "zod";
import { isConfigured } from "./config.ts";
import { query, type QueryDeps } from "./query.ts";

export const freshnessRow = z.object({
  asOfDate: z.coerce.date(),
  personaSnapshotDate: z.coerce.date().nullable(),
});
export type Freshness = z.infer<typeof freshnessRow>;

export async function readFreshness(deps: QueryDeps = {}): Promise<{ freshness: Freshness; ms: number }> {
  const { rows, ms } = await query(
    {
      name: "freshness",
      sql: "SELECT asOfDate, personaSnapshotDate FROM dbo.persona_vw_api_v1_freshness",
      schema: freshnessRow,
    },
    deps,
  );
  if (!rows.length) throw new Error("persona_vw_api_v1_freshness returned no rows");
  return { freshness: rows[0], ms };
}

export interface FabricStatus {
  ok: boolean;
  detail: string;
}

/** Never throws: the health endpoint reports the failure rather than becoming one. */
export async function checkFabric(deps: QueryDeps = {}, env = process.env): Promise<FabricStatus> {
  if (!isConfigured(env)) {
    return { ok: false, detail: "not configured — set FABRIC_SQL_ENDPOINT and FABRIC_SQL_DATABASE" };
  }
  try {
    const { freshness, ms } = await readFreshness(deps);
    const asOf = freshness.asOfDate.toISOString().slice(0, 10);
    return { ok: true, detail: `connected in ${ms}ms, data as of ${asOf}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
