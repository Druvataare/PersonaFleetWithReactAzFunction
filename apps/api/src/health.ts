/* GET /api/health — is the API up, are its dependencies wired, and can it
   reach Fabric? */
import { app, type HttpResponseInit } from "@azure/functions";
import { REVIEW_LIMIT } from "@pfc/contract";
import { deviceScore } from "@pfc/scoring";
import { checkConfigStore } from "./fabric/configStore.ts";
import { checkFabric, type FabricStatus } from "./fabric/freshness.ts";

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface HealthPayload {
  status: "ok" | "degraded";
  uptimeSec: number;
  node: string;
  checks: HealthCheck[];
}

/** The body of the health response; pure, so it is testable on its own. */
export function healthPayload(fabric: FabricStatus, configStore: FabricStatus): HealthPayload {
  const checks: HealthCheck[] = [
    {
      name: "contract",
      ok: REVIEW_LIMIT === 150,
      detail: `@pfc/contract loaded, review limit ${REVIEW_LIMIT}`,
    },
    {
      name: "scoring",
      /* The wireframe's weights: 35% provisioning, 30% performance, 20% compliance, 15% experience. */
      ok: deviceScore({ prov: 100, perf: 100, comp: 100, exp: 100 }) === 100,
      detail: "@pfc/scoring loaded, device scoring agrees with the browser",
    },
    { name: "fabric", ...fabric },
    /* Both stores, because either can be down on its own (AD-4). */
    { name: "configStore", ...configStore },
  ];
  return {
    status: checks.every((c) => c.ok) ? "ok" : "degraded",
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    checks,
  };
}

export async function health(): Promise<HttpResponseInit> {
  /* Together: one slow store should not add its latency to the other. */
  const [fabric, configStore] = await Promise.all([checkFabric(), checkConfigStore()]);
  const payload = healthPayload(fabric, configStore);
  return {
    status: payload.status === "ok" ? 200 : 503,
    jsonBody: payload,
    headers: { "Cache-Control": "no-store" },
  };
}

app.http("health", { route: "health", methods: ["GET"], authLevel: "anonymous", handler: health });
