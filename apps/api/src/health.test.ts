import { describe, expect, it } from "vitest";
import { healthPayload } from "./health.ts";

describe("health", () => {
  it("is ok only when every check passes, including Fabric", () => {
    const ok = healthPayload({ ok: true, detail: "connected in 41ms, data as of 2026-09-09" });
    expect(ok.status).toBe("ok");
    expect(ok.checks.map((c) => [c.name, c.ok])).toEqual([
      ["contract", true],
      ["scoring", true],
      ["fabric", true],
    ]);
    expect(ok.node).toMatch(/^v\d+\./);
  });

  it("is degraded, with the reason, when Fabric is not reachable", () => {
    const degraded = healthPayload({ ok: false, detail: "not configured" });
    expect(degraded.status).toBe("degraded");
    expect(degraded.checks.find((c) => c.name === "fabric")).toEqual({
      name: "fabric",
      ok: false,
      detail: "not configured",
    });
  });
});
