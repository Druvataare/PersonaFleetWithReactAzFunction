import { describe, expect, it } from "vitest";
import { health, healthPayload } from "./health.ts";

describe("health", () => {
  it("reports the shared packages as wired and Fabric as not yet connected", () => {
    const payload = healthPayload();
    expect(payload.checks.map((c) => [c.name, c.ok])).toEqual([
      ["contract", true],
      ["scoring", true],
      ["fabric", false],
    ]);
    expect(payload.status).toBe("degraded");
    expect(payload.node).toMatch(/^v\d+\./);
  });

  it("answers with JSON that is never cached", async () => {
    const response = await health();
    expect(response.headers).toEqual({ "Cache-Control": "no-store" });
    expect((response.jsonBody as { checks: unknown[] }).checks).toHaveLength(3);
  });
});
