/* GET /api/fleet/devices — every device in the fleet, grouped by persona,
   each carrying its recent incidents and its catalogue applications.

   Shipped whole rather than paged: see backend.md, step 7. The contract is
   frozen (AD-11) and useFleetModel composes the entire fleet client-side to
   compute scores, so paging would change the contract, the model and every
   page that reads it. We measure first and decide after.

   Three views, three grains, one response — the same reasoning as /api/catalog.
   Joining device to tickets and apps in SQL would repeat each device row once
   per ticket per app and leave the mapper to undo the multiplication. */
import { app } from "@azure/functions";
import type { DevicesResponse } from "@pfc/contract";
import type { Device, DeviceTicket, PersonaId, Priority } from "@pfc/scoring";
import { z } from "zod";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";

const priority = z.enum(["P1", "P2", "P3", "P4"]);

/* Only the four telemetry measures are nullable, and only because the gold
   build says so: a device with no battery reports null rather than zero, and
   one that has never reported boot or crash data reports null too. Everything
   else is required, so a null identity or a missing hostname fails loudly
   here naming the field (AD-18) instead of reaching the browser as undefined. */
export const deviceRow = z.object({
  id: z.string(),
  personaId: z.string(),
  host: z.string(),
  user: z.string(),
  email: z.string(),
  site: z.string(),
  model: z.string(),
  ramGB: z.number().int(),
  storageGB: z.number().int(),
  freePct: z.number().nullable(),
  cpuScore: z.number().int(),
  bootSec: z.number().nullable(),
  crashes: z.number().int().nullable(),
  batteryPct: z.number().nullable(),
  patched: z.boolean(),
  osBuild: z.string(),
  lastSeen: z.number().int(),
  missingMeasures: z.string().nullable(),
});

export const deviceTicketRow = z.object({
  deviceId: z.string(),
  number: z.string(),
  cat: z.string(),
  short: z.string(),
  priority,
  state: z.string(),
  group: z.string(),
  ageDays: z.number().int(),
});

export const deviceAppRow = z.object({ deviceId: z.string(), app: z.string() });

export type DeviceRow = z.infer<typeof deviceRow>;
export type DeviceTicketRow = z.infer<typeof deviceTicketRow>;
export type DeviceAppRow = z.infer<typeof deviceAppRow>;

/* What a missing measure becomes, and why these values.

   The contract has no way to express "unknown": every measure on Device is a
   plain number, because the mock always generated one. So a null has to
   become some number, and the only question is which lie does least harm.

   Scoring treats each measure as "at or better than baseline scores 100",
   so these four are the values that score exactly 100 whatever the persona's
   baseline is — no need to read the configuration store to neutralise them.
   The alternative, letting null fall through arithmetic, yields zero: a
   device would be marked as booting infinitely slowly and holding no disk
   space purely because it never reported, dragging its persona's health down
   for data we do not have. Penalising absent evidence is the worse error.

   This is a derivation, not a measurement, and it is only honest if the
   scale of it is visible — hence the coverage figures recorded in backend.md
   rather than left implicit. For battery it is not even a derivation: a
   desktop has no battery, so it cannot have a battery problem. */
const NEUTRAL = { freePct: 100, bootSec: 0, crashes: 0, batteryPct: 100 } as const;

function toDevice(row: DeviceRow, tickets: DeviceTicket[], installed: string[]): Device {
  return {
    id: row.id,
    host: row.host,
    user: row.user,
    email: row.email,
    site: row.site,
    model: row.model,
    ramGB: row.ramGB,
    storageGB: row.storageGB,
    freePct: row.freePct ?? NEUTRAL.freePct,
    cpuScore: row.cpuScore,
    bootSec: row.bootSec ?? NEUTRAL.bootSec,
    crashes: row.crashes ?? NEUTRAL.crashes,
    batteryPct: row.batteryPct ?? NEUTRAL.batteryPct,
    patched: row.patched,
    osBuild: row.osBuild,
    lastSeen: row.lastSeen,
    tickets,
    installed,
  };
}

/** Groups rows by a key, preserving the order the database returned them. */
function groupBy<T, V>(rows: T[], key: (row: T) => string, value: (row: T) => V): Map<string, V[]> {
  const out = new Map<string, V[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(value(row));
    else out.set(k, [value(row)]);
  }
  return out;
}

export function buildDevices(
  devices: DeviceRow[],
  tickets: DeviceTicketRow[],
  apps: DeviceAppRow[],
): DevicesResponse {
  const ticketsByDevice = groupBy(
    tickets,
    (t) => t.deviceId,
    ({ number, cat, short, priority: p, state, group, ageDays }): DeviceTicket => ({
      number,
      cat,
      short,
      priority: p as Priority,
      state,
      group,
      ageDays,
    }),
  );
  const appsByDevice = groupBy(
    apps,
    (a) => a.deviceId,
    (a) => a.app,
  );

  const byPersona: DevicesResponse = {};
  for (const row of devices) {
    const persona: PersonaId = row.personaId;
    /* A ticket or app for an unknown device cannot appear: both are keyed
       from the device itself. A device with neither gets empty arrays, never
       undefined, so the Device page renders "none" rather than throwing. */
    const device = toDevice(row, ticketsByDevice.get(row.id) ?? [], appsByDevice.get(row.id) ?? []);
    (byPersona[persona] ??= []).push(device);
  }
  return byPersona;
}

export async function readDevices(deps: QueryDeps = {}): Promise<DevicesResponse> {
  const [devices, tickets, apps] = await Promise.all([
    query(
      {
        name: "fleet.devices",
        sql: `SELECT id, personaId, host, [user], email, site, model, ramGB, storageGB,
                     freePct, cpuScore, bootSec, crashes, batteryPct, patched, osBuild,
                     lastSeen, missingMeasures
              FROM dbo.persona_vw_api_v1_device
              ORDER BY personaId, host`,
        schema: deviceRow,
      },
      deps,
    ),
    query(
      {
        name: "fleet.tickets",
        sql: `SELECT deviceId, number, cat, short, priority, state, [group], ageDays
              FROM dbo.persona_vw_api_v1_device_ticket
              ORDER BY deviceId, ageDays DESC`,
        schema: deviceTicketRow,
      },
      deps,
    ),
    query(
      {
        name: "fleet.apps",
        sql: `SELECT deviceId, app
              FROM dbo.persona_vw_api_v1_device_app
              ORDER BY deviceId, app`,
        schema: deviceAppRow,
      },
      deps,
    ),
  ]);

  return buildDevices(devices.rows, tickets.rows, apps.rows);
}

app.http("fleet-devices", {
  route: "fleet/devices",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("fleet devices", () => readDevices()),
});
