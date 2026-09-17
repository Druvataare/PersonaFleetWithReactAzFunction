import type { Baseline, Device, PersonaModel, Tone } from "./types.ts";

export type FitKind = "fit" | "under" | "over" | "crit";

/** Fit categories in display order, with label and tone. Over-provisioned uses the accent colour. */
export const FIT_KINDS: ReadonlyArray<{ key: FitKind; label: string; tone: Tone | "accent" }> = [
  { key: "fit", label: "Fit devices", tone: "good" },
  { key: "under", label: "Under provisioned", tone: "warn" },
  { key: "over", label: "Over-provisioned", tone: "accent" },
  { key: "crit", label: "Critically mismatched", tone: "bad" },
];

/**
 * Grades CPU, RAM and SSD only. Below on two or more parts is critical; below on one is
 * under-provisioned; above on any part with none below is over-provisioned; otherwise fit.
 */
export function fitClass(d: Pick<Device, "ramGB" | "storageGB" | "cpuScore">, b: Baseline): FitKind {
  const below =
    Number(d.ramGB < b.ramGB) + Number(d.storageGB < b.storageGB) + Number(d.cpuScore < b.cpuScore);
  const above =
    Number(d.ramGB > b.ramGB) + Number(d.storageGB > b.storageGB) + Number(d.cpuScore > b.cpuScore);
  return below >= 2 ? "crit" : below === 1 ? "under" : above > 0 ? "over" : "fit";
}

export interface PersonaFit extends Record<FitKind, number> {
  id: string;
  name: string;
  hue: string;
  total: number;
  /** Share of sample devices meeting the baseline on each part, rounded percent. */
  cpuPct: number;
  ramPct: number;
  ssdPct: number;
}

/** Fit counts per persona, scaled from the sample to headcount. */
export function fitByPersona(models: readonly PersonaModel[]): PersonaFit[] {
  return models.map((p) => {
    const b = p.baseline;
    const n = p.devices.length;
    const scale = n ? p.count / n : 0;
    const raw: Record<FitKind, number> = { fit: 0, under: 0, over: 0, crit: 0 };
    p.devices.forEach((d) => raw[fitClass(d, b)]++);
    const pct = (ok: number) => (n ? Math.round((ok / n) * 100) : 0);
    return {
      id: p.id,
      name: p.name,
      hue: p.hue,
      total: p.count,
      fit: Math.round(raw.fit * scale),
      under: Math.round(raw.under * scale),
      over: Math.round(raw.over * scale),
      crit: Math.round(raw.crit * scale),
      cpuPct: pct(p.devices.filter((d) => d.cpuScore >= b.cpuScore).length),
      ramPct: pct(p.devices.filter((d) => d.ramGB >= b.ramGB).length),
      ssdPct: pct(p.devices.filter((d) => d.storageGB >= b.storageGB).length),
    };
  });
}
