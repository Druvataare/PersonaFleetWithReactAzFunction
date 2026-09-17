import { clamp, mean } from "./math.ts";
import type { Baseline, Device, DevicePillars } from "./types.ts";

/** Grades one device against its persona baseline on four pillars (0–100 each). */
export function scoreDevice(d: Device, b: Baseline): DevicePillars {
  const prov = mean(
    [
      d.ramGB >= b.ramGB ? 100 : clamp((d.ramGB / b.ramGB) * 100),
      d.storageGB >= b.storageGB ? 100 : clamp((d.storageGB / b.storageGB) * 100),
      d.cpuScore >= b.cpuScore ? 100 : clamp((d.cpuScore / b.cpuScore) * 100),
    ],
    (v) => v,
  );
  const perf = clamp(
    0.6 * (d.bootSec <= b.bootSec ? 100 : 100 - ((d.bootSec - b.bootSec) / b.bootSec) * 90) +
      0.4 * (d.crashes <= b.crashes ? 100 : 100 - (d.crashes - b.crashes) * 22),
  );
  const comp = clamp((d.patched ? 70 : 20) + (d.osBuild.indexOf("Win11") === 0 ? 30 : 5));
  const exp = clamp(
    0.5 * (d.freePct >= b.freePct ? 100 : (d.freePct / b.freePct) * 100) +
      0.5 * (d.batteryPct >= b.batteryPct ? 100 : (d.batteryPct / b.batteryPct) * 100),
  );
  return {
    prov,
    perf,
    comp,
    exp,
    underProv: d.ramGB < b.ramGB || d.storageGB < b.storageGB || d.cpuScore < b.cpuScore,
  };
}

/** Composite device health: 35% provisioning, 30% performance, 20% compliance, 15% experience. */
export const deviceScore = (s: Pick<DevicePillars, "prov" | "perf" | "comp" | "exp">): number =>
  0.35 * s.prov + 0.3 * s.perf + 0.2 * s.comp + 0.15 * s.exp;
