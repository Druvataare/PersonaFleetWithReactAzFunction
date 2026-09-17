import { scoreDevice } from "./device.ts";
import type { Baseline, Device, DevicePillars, PersonaId } from "./types.ts";

export type RiskLevel = "Low" | "Medium" | "High";

export const RISK_RANK: Readonly<Record<RiskLevel, number>> = { Low: 1, Medium: 2, High: 3 };

/** Unpatched and on Windows 10 is high; either one is medium; neither is low. */
export function securityRisk(d: Pick<Device, "patched" | "osBuild">): RiskLevel {
  const win10 = d.osBuild.indexOf("Win10") === 0;
  return !d.patched && win10 ? "High" : !d.patched || win10 ? "Medium" : "Low";
}

export interface SwitchContext {
  baselines: Readonly<Record<PersonaId, Baseline>>;
  apps: Readonly<Record<PersonaId, readonly string[]>>;
  tasksAutomated: Readonly<Record<PersonaId, number>>;
  onboardingDays: Readonly<Record<PersonaId, number>>;
}

export interface SwitchMetrics {
  prodBefore: number;
  prodAfter: number;
  tasksBefore: number;
  tasksAfter: number;
  add: string[];
  rem: string[];
  need: string[];
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  fitBefore: boolean;
  tixBefore: number;
  tixAfter: number;
  onBefore: number;
  onAfter: number;
  uxBefore: number;
  uxAfter: number;
  bootBefore: number;
  bootAfter: number;
  ramBefore: number;
  ramAfter: number;
  stBefore: number;
  stAfter: number;
  /** Device score against its current (from) baseline. */
  baseFit: number;
}

/** Rounded composite from device pillars. */
const composite = (s: DevicePillars): number =>
  Math.round(0.35 * s.prov + 0.3 * s.perf + 0.2 * s.comp + 0.15 * s.exp);

/**
 * Before/after impact of moving a user's device from one persona to another.
 * "After" values assume the device is brought up to the new persona's baseline.
 */
export function switchMetrics(d: Device, from: PersonaId, to: PersonaId, ctx: SwitchContext): SwitchMetrics {
  const bF = ctx.baselines[from];
  const bT = ctx.baselines[to];
  const sF = scoreDevice(d, bF);
  const sT = scoreDevice(d, bT);
  const appsFrom = ctx.apps[from] ?? [];
  const appsTo = ctx.apps[to] ?? [];
  return {
    prodBefore: composite(sT),
    prodAfter: 96,
    tasksBefore: ctx.tasksAutomated[from],
    tasksAfter: ctx.tasksAutomated[to],
    add: appsTo.filter((a) => !appsFrom.includes(a)),
    rem: appsFrom.filter((a) => !appsTo.includes(a)),
    need: appsTo.filter((a) => !d.installed.includes(a)),
    riskBefore: securityRisk(d),
    riskAfter: "Low",
    fitBefore: d.ramGB >= bT.ramGB && d.storageGB >= bT.storageGB && d.cpuScore >= bT.cpuScore,
    tixBefore: d.tickets.length,
    tixAfter: +(bT.ticketsPer100 / 100).toFixed(2),
    onBefore: ctx.onboardingDays[from],
    onAfter: ctx.onboardingDays[to],
    uxBefore: Math.round(sT.exp),
    uxAfter: 95,
    bootBefore: d.bootSec,
    bootAfter: bT.bootSec,
    ramBefore: d.ramGB,
    ramAfter: Math.max(d.ramGB, bT.ramGB),
    stBefore: d.storageGB,
    stAfter: Math.max(d.storageGB, bT.storageGB),
    baseFit: composite(sF),
  };
}
