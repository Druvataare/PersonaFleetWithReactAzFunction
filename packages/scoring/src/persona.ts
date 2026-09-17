import { deviceScore, scoreDevice } from "./device.ts";
import { clamp, mean, sum } from "./math.ts";
import type {
  AppException,
  Baseline,
  Device,
  Migration,
  PersonaDef,
  PersonaId,
  PersonaModel,
  Pillars,
  Weights,
} from "./types.ts";

export interface PersonaInput {
  persona: PersonaDef;
  /** Sample device rows for this persona. */
  devices: Device[];
  baseline: Baseline;
  weights: Weights;
  migrations: readonly Migration[];
  exceptions: readonly AppException[];
}

/** Support pillar: 100 at or under the ticket ceiling, falling 70 points per 100% over it. */
export const supportScore = (per100: number, ceiling: number): number =>
  clamp(per100 <= ceiling ? 100 : 100 - ((per100 - ceiling) / ceiling) * 70);

/** Weighted persona health from its five pillars. */
export const personaHealth = (p: Pillars, w: Weights): number =>
  (p.prov * w.prov + p.perf * w.perf + p.comp * w.comp + p.exp * w.exp + p.sup * w.sup) /
  (w.prov + w.perf + w.comp + w.exp + w.sup);

/** Scores every sample device and rolls the result up to persona level, scaled to headcount. */
export function buildPersonaModel({
  persona: p,
  devices: sample,
  baseline: b,
  weights: w,
  migrations,
  exceptions,
}: PersonaInput): PersonaModel {
  const n = sample.length;
  const devices = sample.map((d) => {
    const s = scoreDevice(d, b);
    return { ...d, s, score: deviceScore(s) };
  });
  const tCount = sum(devices, (d) => d.tickets.length);
  const per100 = n ? (tCount / n) * 100 : 0;
  const pillars: Pillars = {
    prov: mean(devices, (d) => d.s.prov),
    perf: mean(devices, (d) => d.s.perf),
    comp: mean(devices, (d) => d.s.comp),
    exp: mean(devices, (d) => d.s.exp),
    sup: supportScore(per100, b.ticketsPer100),
  };
  const underPct = n ? devices.filter((d) => d.s.underProv).length / n : 0;
  const exc = exceptions.filter((e) => e.persona === p.id);
  return {
    id: p.id,
    name: p.name,
    sub: p.sub,
    hue: p.hue,
    count: p.count,
    devices,
    baseline: b,
    weights: w,
    pillars,
    health: personaHealth(pillars, w),
    underPct,
    underCount: Math.round(underPct * p.count),
    openTickets: n ? Math.round((tCount / n) * p.count) : 0,
    ticketsPer100: per100,
    patchPct: mean(devices, (d) => (d.patched ? 100 : 0)),
    avgBoot: mean(devices, (d) => d.bootSec),
    movedIn: sum(
      migrations.filter((m) => m.to === p.id),
      (m) => m.people,
    ),
    movedOut: sum(
      migrations.filter((m) => m.from === p.id),
      (m) => m.people,
    ),
    exceptions: exc,
    excPending: exc.filter((e) => e.state === "Pending").length,
  };
}

export interface FleetInput {
  personas: readonly PersonaDef[];
  devicesByPersona: Readonly<Record<PersonaId, Device[]>>;
  baselines: Readonly<Record<PersonaId, Baseline>>;
  weights: Readonly<Record<PersonaId, Weights>>;
  migrations: readonly Migration[];
  exceptions: readonly AppException[];
}

/** Builds the model for every persona, in persona order. */
export const buildModel = (f: FleetInput): PersonaModel[] =>
  f.personas.map((persona) =>
    buildPersonaModel({
      persona,
      devices: f.devicesByPersona[persona.id] ?? [],
      baseline: f.baselines[persona.id],
      weights: f.weights[persona.id],
      migrations: f.migrations,
      exceptions: f.exceptions,
    }),
  );
