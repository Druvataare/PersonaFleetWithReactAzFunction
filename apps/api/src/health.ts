/* GET /api/health — is the API up, and are its dependencies wired?
   Step 4 adds the Fabric connection to the checks. */
import { app, type HttpResponseInit } from "@azure/functions";
import { REVIEW_LIMIT } from "@pfc/contract";
import { deviceScore } from "@pfc/scoring";

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

/** The body of the health response; kept separate from the handler so it is testable on its own. */
export function healthPayload(): HealthPayload {
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
    { name: "fabric", ok: false, detail: "not connected yet — step 4" },
  ];
  return {
    status: checks.every((c) => c.ok) ? "ok" : "degraded",
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    checks,
  };
}

export async function health(): Promise<HttpResponseInit> {
  return { jsonBody: healthPayload(), headers: { "Cache-Control": "no-store" } };
}

app.http("health", { route: "health", methods: ["GET"], authLevel: "anonymous", handler: health });
