/* Shared domain types. Field names follow the wireframe so the sample
   data, the web app and the future API all speak the same shape. */

export type PersonaId = string;

/** Persona definition. `count` is headcount (people / devices in the estate). */
export interface PersonaDef {
  id: PersonaId;
  name: string;
  sub: string;
  count: number;
  hue: string;
}

/** The contract every device in a persona is measured against. */
export interface Baseline {
  ramGB: number;
  storageGB: number;
  cpuScore: number;
  bootSec: number;
  crashes: number;
  freePct: number;
  batteryPct: number;
  ticketsPer100: number;
}

/** Pillar weights used to combine pillar scores into persona health. */
export interface Weights {
  prov: number;
  perf: number;
  comp: number;
  exp: number;
  sup: number;
}

export type Priority = "P1" | "P2" | "P3" | "P4";

export interface DeviceTicket {
  number: string;
  cat: string;
  short: string;
  priority: Priority;
  state: string;
  group: string;
  ageDays: number;
}

export interface Device {
  id: string;
  host: string;
  user: string;
  email: string;
  site: string;
  model: string;
  ramGB: number;
  storageGB: number;
  freePct: number;
  cpuScore: number;
  bootSec: number;
  crashes: number;
  batteryPct: number;
  patched: boolean;
  osBuild: string;
  lastSeen: number;
  tickets: DeviceTicket[];
  installed: string[];
}

export interface Migration {
  from: PersonaId;
  to: PersonaId;
  people: number;
}

export type ExceptionState = "Pending" | "Approved" | "Rejected";

export interface AppException {
  id: string;
  user: string;
  persona: PersonaId;
  app: string;
  reason: string;
  state: ExceptionState;
  raised: number;
}

/** Per-device pillar scores (0–100). */
export interface DevicePillars {
  prov: number;
  perf: number;
  comp: number;
  exp: number;
  underProv: boolean;
}

export interface ScoredDevice extends Device {
  s: DevicePillars;
  /** Composite device health (0–100). */
  score: number;
}

export interface Pillars {
  prov: number;
  perf: number;
  comp: number;
  exp: number;
  sup: number;
}

export interface PersonaModel {
  id: PersonaId;
  name: string;
  sub: string;
  hue: string;
  /** Headcount. */
  count: number;
  /** Sample device rows, scored. */
  devices: ScoredDevice[];
  baseline: Baseline;
  weights: Weights;
  pillars: Pillars;
  health: number;
  underPct: number;
  underCount: number;
  openTickets: number;
  ticketsPer100: number;
  patchPct: number;
  avgBoot: number;
  movedIn: number;
  movedOut: number;
  exceptions: AppException[];
  excPending: number;
}

/** Semantic tone. The UI maps it to theme colours. */
export type Tone = "good" | "warn" | "bad";
