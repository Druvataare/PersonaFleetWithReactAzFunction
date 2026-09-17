/* Baselines page definitions: the eight contract fields and fit totals. */
import { FIT_KINDS, type Baseline, type FitKind, type PersonaFit } from "@pfc/scoring";
import type { IconName } from "../components/Icon.tsx";
import { gb } from "./format.ts";

export interface BaselineField {
  k: keyof Baseline;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  icon: IconName;
}

export const BASELINE_FIELDS: readonly BaselineField[] = [
  { k: "ramGB", label: "Minimum memory", unit: "GB", step: 8, min: 8, max: 128, icon: "ram" },
  { k: "storageGB", label: "Minimum storage", unit: "GB", step: 256, min: 256, max: 4096, icon: "disk" },
  { k: "cpuScore", label: "Minimum CPU index", unit: "", step: 2, min: 30, max: 100, icon: "cpu" },
  { k: "bootSec", label: "Maximum boot time", unit: "s", step: 5, min: 15, max: 120, icon: "clock" },
  { k: "crashes", label: "Maximum crashes / 30d", unit: "", step: 1, min: 0, max: 10, icon: "alert" },
  { k: "freePct", label: "Minimum free disk", unit: "%", step: 5, min: 5, max: 50, icon: "disk" },
  {
    k: "batteryPct",
    label: "Minimum battery health",
    unit: "%",
    step: 5,
    min: 40,
    max: 100,
    icon: "battery",
  },
  {
    k: "ticketsPer100",
    label: "Ticket ceiling / 100 devices",
    unit: "",
    step: 1,
    min: 2,
    max: 40,
    icon: "ticket",
  },
];

export const fieldValue = (f: BaselineField, v: number) => (f.k === "storageGB" ? gb(v) : v + f.unit);

export type FitTotals = Record<FitKind, number>;

export function fitTotals(rows: readonly PersonaFit[]): { tot: FitTotals; total: number } {
  const tot = { fit: 0, under: 0, over: 0, crit: 0 };
  let total = 0;
  rows.forEach((r) => {
    FIT_KINDS.forEach(({ key }) => (tot[key] += r[key]));
    total += r.total;
  });
  return { tot, total };
}

export const pctOf = (v: number, total: number) => (total ? ((v / total) * 100).toFixed(1) + "%" : "0%");
