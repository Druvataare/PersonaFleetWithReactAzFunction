/* Is the configuration store reachable, and does it hold policy?

   A separate check from Fabric's because they are separate databases that
   fail separately — which /api/health learned the hard way on 24 Sep 2026,
   reporting "ok" while /api/baselines was returning 500s, because it only
   ever looked at the lakehouse. A health check that can be green while an
   endpoint is down is worse than none: it sends you to the wrong place.

   Counting persona_policy rather than SELECT 1 so the answer also says
   whether the seed is there. Connected but empty is a real state — the
   schema applied, the seed never ran — and every score in the portal would
   be missing its baseline. */
import { z } from "zod";
import { isConfigStoreConfigured, readConfigStore } from "./config.ts";
import { query, type QueryDeps } from "./query.ts";
import type { FabricStatus } from "./freshness.ts";

export const policyCountRow = z.object({ personas: z.number().int() });

export async function readPolicyCount(deps: QueryDeps = {}): Promise<{ personas: number; ms: number }> {
  const { rows, ms } = await query(
    {
      name: "policy-count",
      sql: "SELECT COUNT(*) AS personas FROM dbo.persona_policy",
      schema: policyCountRow,
    },
    { ...deps, config: deps.config ?? readConfigStore() },
  );
  return { personas: rows[0]?.personas ?? 0, ms };
}

/** Never throws: the health endpoint reports the failure rather than becoming one. */
export async function checkConfigStore(deps: QueryDeps = {}, env = process.env): Promise<FabricStatus> {
  if (!isConfigStoreConfigured(env)) {
    return { ok: false, detail: "not configured — set ConfigSqlEndpoint and ConfigSqlDatabase" };
  }
  try {
    const { personas, ms } = await readPolicyCount(deps);
    return personas > 0
      ? { ok: true, detail: `connected in ${ms}ms, ${personas} personas have policy` }
      : { ok: false, detail: "connected, but persona_policy is empty — run sql/config/05b_seed_persona_policy.sql" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
