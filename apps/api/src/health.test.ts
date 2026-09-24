import { describe, expect, it } from "vitest";
import { healthPayload } from "./health.ts";

describe("health", () => {
  it("is ok only when every check passes, including Fabric", () => {
    const ok = healthPayload(
      { ok: true, detail: "connected in 41ms, data as of 2026-09-09" },
      { ok: true, detail: "connected in 12ms, 6 personas have policy" },
    );
    expect(ok.status).toBe("ok");
    expect(ok.checks.map((c) => [c.name, c.ok])).toEqual([
      ["contract", true],
      ["scoring", true],
      ["fabric", true],
      ["configStore", true],
    ]);
    expect(ok.node).toMatch(/^v\d+\./);
  });

  it("is degraded, with the reason, when Fabric is not reachable", () => {
    const degraded = healthPayload({ ok: false, detail: "not configured" }, { ok: true, detail: "fine" });
    expect(degraded.status).toBe("degraded");
    expect(degraded.checks.find((c) => c.name === "fabric")).toEqual({
      name: "fabric",
      ok: false,
      detail: "not configured",
    });
  });

  /* The failure this check was added for: the lakehouse healthy, the
     configuration store not, and /api/health previously reporting ok. */
  it("is degraded when only the configuration store is unreachable", () => {
    const degraded = healthPayload(
      { ok: true, detail: "connected" },
      { ok: false, detail: "Login failed for user" },
    );
    expect(degraded.status).toBe("degraded");
    expect(degraded.checks.find((c) => c.name === "configStore")?.ok).toBe(false);
  });
});
