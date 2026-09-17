/* Sample-data generator ported from the wireframe. The order of random calls
   (including evaluation order inside object literals) must not change, or the
   numbers will stop matching the wireframe. The parity test guards this. */
import type {
  AppException,
  Baseline,
  Device,
  DeviceTicket,
  Migration,
  PersonaDef,
  PersonaId,
  Priority,
  Weights,
} from "@pfc/scoring";
import type { FleetTicket, TicketKind, TitleRow } from "../../api/types.ts";
import {
  APPS,
  CATALOG,
  DEFAULT_BASELINE,
  DEPTS,
  EXCEPTION_WEIGHT,
  FIRST,
  GRADES,
  HUE,
  INC_GROUPS,
  INC_RATE,
  LAST,
  LOW_REASON,
  MIGRATIONS,
  MISMAP,
  MODELS,
  NAMED_EXCEPTIONS,
  ONBOARD_DAYS,
  PERSONA_DEFS,
  REASONS,
  REQ_GROUPS,
  REQ_RATE,
  REQ_TITLES,
  ROLES,
  SAMPLE_SIZE,
  SEED,
  SITES,
  SUFFIX,
  TASKS_AUTO,
  TICKET_CATS,
  TICKET_TITLES,
  UNDER_RATE,
  WEIGHTS,
} from "./catalog.ts";
import { createRandom, type Random } from "./random.ts";

export interface FleetData {
  personas: PersonaDef[];
  apps: Record<PersonaId, string[]>;
  defaultBaselines: Record<PersonaId, Baseline>;
  weights: Record<PersonaId, Weights>;
  tasksAutomated: Record<PersonaId, number>;
  onboardingDays: Record<PersonaId, number>;
  devicesByPersona: Record<PersonaId, Device[]>;
  migrations: Migration[];
  exceptions: AppException[];
  titleRows: TitleRow[];
  incidents: FleetTicket[];
  requests: FleetTicket[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function makeDevices({ rnd, pick, iBetween }: Random, pid: PersonaId, n: number): Device[] {
  const b = DEFAULT_BASELINE[pid];
  const out: Device[] = [];
  for (let i = 0; i < n; i++) {
    const under = rnd() < UNDER_RATE[pid];
    const ramGB =
      under && rnd() < 0.7
        ? (pick([8, 16, 32].filter((r) => r < b.ramGB)) as number | undefined) || 8
        : pick([b.ramGB, b.ramGB, b.ramGB * 2]);
    const storageGB =
      under && rnd() < 0.6
        ? (pick([256, 512, 1024].filter((s) => s < b.storageGB)) as number | undefined) || 256
        : b.storageGB;
    const cpuScore = under ? iBetween(b.cpuScore - 26, b.cpuScore - 3) : iBetween(b.cpuScore, 98);
    const user = pick(FIRST) + " " + pick(LAST);
    const tickets: DeviceTicket[] = [];
    const tn = rnd() < 0.55 ? iBetween(1, 3) : 0;
    for (let t = 0; t < tn; t++) {
      const cat = pick(TICKET_CATS);
      tickets.push({
        number: "INC00" + iBetween(41000, 49999),
        cat,
        short: pick(TICKET_TITLES[cat]),
        priority: pick<Priority>(["P1", "P2", "P2", "P3", "P3", "P4"]),
        state: pick(["New", "In Progress", "In Progress", "On Hold", "Resolved"]),
        group: pick(INC_GROUPS),
        ageDays: iBetween(1, 34),
      });
    }
    const catalog = APPS[pid];
    const installed = catalog.filter(() => rnd() > 0.12);
    const extra = rnd() < 0.22 ? [pick(Object.values(APPS).flat())] : [];
    const [first, last] = user.split(" ");
    out.push({
      id: pid + "-" + String(i + 1).padStart(4, "0"),
      host: pid + "-WKS-" + iBetween(1000, 9999),
      user,
      email: first.toLowerCase() + "." + last.toLowerCase() + "@contoso.com",
      site: pick(SITES),
      model: pick(MODELS[pid]),
      ramGB,
      storageGB,
      freePct: iBetween(6, 62),
      cpuScore,
      bootSec: iBetween(b.bootSec - 14, b.bootSec + 46),
      crashes: rnd() < 0.7 ? iBetween(0, b.crashes) : iBetween(b.crashes + 1, b.crashes + 6),
      batteryPct: iBetween(48, 100),
      patched: rnd() > 0.14,
      osBuild: pick(["Win11 23H2", "Win11 24H2", "Win11 24H2", "Win10 22H2"]),
      lastSeen: iBetween(0, 9),
      tickets,
      installed: installed.concat(extra),
    });
  }
  return out;
}

function makeExceptions({ pick, iBetween }: Random): AppException[] {
  const generated: AppException[] = [];
  Object.keys(EXCEPTION_WEIGHT).forEach((pid) => {
    for (let i = 0; i < EXCEPTION_WEIGHT[pid]; i++) {
      const outside = Object.keys(APPS).filter((k) => k !== pid);
      generated.push({
        id: "RITM00" + iBetween(49300, 49900),
        user: pick(FIRST) + " " + pick(LAST),
        persona: pid,
        app: pick(APPS[pick(outside)]),
        reason: pick(REASONS),
        state: pick<AppException["state"]>([
          "Pending",
          "Pending",
          "Approved",
          "Approved",
          "Approved",
          "Rejected",
        ]),
        raised: iBetween(1, 40),
      });
    }
  });
  return (clone(NAMED_EXCEPTIONS) as unknown as AppException[]).concat(generated);
}

function makeTitleRows({ rnd, pick, iBetween }: Random, personas: readonly PersonaDef[]): TitleRow[] {
  const out: TitleRow[] = [];
  personas.forEach((p) => {
    for (let i = 0; i < p.count; i++) {
      const g = pick(GRADES);
      const base = pick(ROLES[p.id]);
      const sfx = pick(SUFFIX);
      const r = rnd();
      const m = MISMAP[p.id];
      const conf = r >= m ? 100 : r < m * 0.45 ? iBetween(12, 49) : iBetween(50, 99);
      out.push({
        t: ((g ? g + " " : "") + base + (sfx ? " " + sfx : "")).trim(),
        dept: pick(DEPTS[p.id]),
        pid: p.id,
        conf,
        why: conf < 50 ? pick(LOW_REASON) : conf < 100 ? "Close second-choice persona" : "",
      });
    }
  });
  return out;
}

const SLA_DAYS: Record<Priority, number> = { P1: 3, P2: 7, P3: 21, P4: 35 };

function makeTickets(
  { pick, iBetween }: Random,
  personas: readonly PersonaDef[],
  kind: TicketKind,
): FleetTicket[] {
  const out: FleetTicket[] = [];
  personas.forEach((p) => {
    const users = p.count;
    const n = Math.round(users * (kind === "inc" ? INC_RATE[p.id] : REQ_RATE[p.id]));
    for (let i = 0; i < n; i++) {
      const cat = kind === "inc" ? pick(TICKET_CATS) : pick(CATALOG);
      const short = pick(kind === "inc" ? TICKET_TITLES[cat] : REQ_TITLES[cat]);
      const ageDays = iBetween(0, 83);
      const state =
        kind === "inc"
          ? pick(["New", "In Progress", "In Progress", "On Hold", "Resolved", "Resolved", "Closed"])
          : pick(["New", "In Progress", "Fulfilled", "Fulfilled", "Fulfilled", "Rejected"]);
      const open = ["New", "In Progress", "On Hold"].includes(state);
      const priority =
        kind === "inc"
          ? pick<Priority>(["P1", "P2", "P2", "P3", "P3", "P3", "P4"])
          : pick<Priority>(["P2", "P3", "P3", "P4", "P4"]);
      out.push({
        id: (kind === "inc" ? "INC00" : "RITM00") + iBetween(41000, 49999),
        pid: p.id,
        uid: p.id + "-U" + iBetween(1, Math.max(2, Math.round(users * 0.7))),
        dept: pick(DEPTS[p.id]),
        cat,
        short,
        priority,
        state,
        open,
        group: pick(kind === "inc" ? INC_GROUPS : REQ_GROUPS),
        ageDays,
        week: Math.min(11, Math.floor(ageDays / 7)),
        sla: open && ageDays > SLA_DAYS[priority],
      });
    }
  });
  return out;
}

/** Generates the full sample estate. Same seed, same data, every time. */
export function generateFleetData(seed: number = SEED): FleetData {
  const random = createRandom(seed);
  const personas: PersonaDef[] = PERSONA_DEFS.map((p) => ({ ...p, hue: HUE[p.id] }));
  const devicesByPersona: Record<PersonaId, Device[]> = {};
  personas.forEach((p) => {
    devicesByPersona[p.id] = makeDevices(random, p.id, SAMPLE_SIZE(p.id));
  });
  const exceptions = makeExceptions(random);
  const titleRows = makeTitleRows(random, personas);
  const incidents = makeTickets(random, personas, "inc");
  const requests = makeTickets(random, personas, "req");
  return {
    personas,
    apps: clone(APPS),
    defaultBaselines: clone(DEFAULT_BASELINE),
    weights: clone(WEIGHTS),
    tasksAutomated: { ...TASKS_AUTO },
    onboardingDays: { ...ONBOARD_DAYS },
    devicesByPersona,
    migrations: clone(MIGRATIONS) as Migration[],
    exceptions,
    titleRows,
    incidents,
    requests,
  };
}
