/* GET /api/baselines — the contract each persona's devices are measured
   against, and the weights that combine their pillar scores.

   The only endpoint that reads the configuration store rather than the
   lakehouse (AD-4): these are the numbers people edit on the Baselines page,
   so they live somewhere transactional where a change takes effect at once
   instead of waiting for a pipeline run. */
import { app } from "@azure/functions";
import type { BaselinesResponse } from "@pfc/contract";
import type { Baseline, PersonaId, Weights } from "@pfc/scoring";
import { z } from "zod";
import { readConfigStore } from "../fabric/config.ts";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";

/* persona_policy is ours, so the SELECT aliases its columns to the Baseline
   and Weights field names and this schema is one-to-one with them. */
export const policyRow = z.object({
  id: z.string(),
  ramGB: z.number().int(),
  storageGB: z.number().int(),
  cpuScore: z.number().int(),
  bootSec: z.number().int(),
  crashes: z.number().int(),
  freePct: z.number().int(),
  batteryPct: z.number().int(),
  ticketsPer100: z.number().int(),
  prov: z.number().int(),
  perf: z.number().int(),
  comp: z.number().int(),
  exp: z.number().int(),
  sup: z.number().int(),
});
export type PolicyRow = z.infer<typeof policyRow>;

/** Splits one policy row into the two shapes the contract keeps apart. */
export function splitPolicy(rows: PolicyRow[]): BaselinesResponse {
  const defaults: Record<PersonaId, Baseline> = {};
  const weights: Record<PersonaId, Weights> = {};
  for (const r of rows) {
    defaults[r.id] = {
      ramGB: r.ramGB,
      storageGB: r.storageGB,
      cpuScore: r.cpuScore,
      bootSec: r.bootSec,
      crashes: r.crashes,
      freePct: r.freePct,
      batteryPct: r.batteryPct,
      ticketsPer100: r.ticketsPer100,
    };
    weights[r.id] = { prov: r.prov, perf: r.perf, comp: r.comp, exp: r.exp, sup: r.sup };
  }
  return { defaults, weights };
}

export async function readBaselines(deps: QueryDeps = {}): Promise<BaselinesResponse> {
  const { rows } = await query(
    {
      name: "baselines",
      sql: `SELECT PersonaKey AS id,
                   RamGB AS ramGB, StorageGB AS storageGB, CpuScore AS cpuScore,
                   BootSec AS bootSec, Crashes AS crashes, FreePct AS freePct,
                   BatteryPct AS batteryPct, TicketsPer100 AS ticketsPer100,
                   WeightProv AS prov, WeightPerf AS perf, WeightComp AS comp,
                   WeightExp AS exp, WeightSup AS sup
            FROM dbo.persona_policy`,
      schema: policyRow,
    },
    /* ?? rather than spreading a call: readConfigStore() throws when the
       settings are missing, so calling it eagerly would fail even for a
       caller that supplied its own connection. */
    { ...deps, config: deps.config ?? readConfigStore() },
  );
  return splitPolicy(rows);
}

app.http("baselines", {
  route: "baselines",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("baselines", () => readBaselines()),
});
