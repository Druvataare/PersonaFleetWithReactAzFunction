/* Device page rules from the wireframe's screenDevice: app entitlement against the
   persona catalogue, and the suggested actions list. */
import type { Baseline, Device } from "@pfc/scoring";
import { gb } from "./format.ts";

export interface Entitlement {
  /** Catalogue apps that are installed. */
  entitled: string[];
  /** Catalogue apps not installed; pushed on next sync. */
  missing: string[];
  /** Installed apps outside the catalogue; need an exception. */
  outside: string[];
}

export function entitlement(installed: readonly string[], catalogue: readonly string[]): Entitlement {
  return {
    entitled: installed.filter((a) => catalogue.includes(a)),
    missing: catalogue.filter((a) => !installed.includes(a)),
    outside: installed.filter((a) => !catalogue.includes(a)),
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** What to do about a device, in the wireframe's order. Empty when it meets every baseline. */
export function suggestedActions(d: Device, b: Baseline, personaName: string, e: Entitlement): string[] {
  return [
    d.ramGB < b.ramGB && `Upgrade memory to ${b.ramGB}GB to meet the ${personaName} baseline`,
    d.storageGB < b.storageGB && `Replace disk — ${gb(b.storageGB)} required`,
    d.cpuScore < b.cpuScore && "Schedule refresh — CPU index below persona floor",
    !d.patched && "Force patch ring re-evaluation",
    d.freePct < b.freePct && "Run storage clean-up policy",
    e.missing.length > 0 && `Push ${plural(e.missing.length, "missing persona app")}`,
    e.outside.length > 0 && `Raise exception or remove ${plural(e.outside.length, "non-persona app")}`,
  ].filter((a): a is string => typeof a === "string");
}
