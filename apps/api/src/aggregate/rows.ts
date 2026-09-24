/* Reading the two grain views behind /api/mapping/* and /api/tickets/summary.

   Grain, not aggregates, on purpose (see backend.md, step 8): the API hands
   these rows to packages/contract/src/aggregate.ts — the very functions the
   mock API runs — so the live and mock responses agree by construction
   rather than because a test remembered to compare them. */
import type { FleetTicket, TitleRow } from "@pfc/contract";
import { z } from "zod";
import { query, type QueryDeps } from "../fabric/query.ts";

const priority = z.enum(["P1", "P2", "P3", "P4"]);

/* Aliased in the view to the FleetTicket field names already, so this schema
   is the contract type restated for the row. `kind` is deliberately absent:
   it is the filter, so it is never selected and never travels — and zod
   would strip it even if the view sent it. */
export const ticketRow = z.object({
  id: z.string(),
  pid: z.string(),
  uid: z.string(),
  dept: z.string(),
  cat: z.string(),
  short: z.string(),
  priority,
  state: z.string(),
  open: z.boolean(),
  group: z.string(),
  ageDays: z.number().int(),
  week: z.number().int(),
  sla: z.boolean(),
});

export const titleRow = z.object({
  t: z.string(),
  dept: z.string(),
  pid: z.string(),
  conf: z.number().int(),
  why: z.string(),
});

export type TicketRow = z.infer<typeof ticketRow>;

/** Every ticket of one kind across the twelve weeks the view exposes.

    Unfiltered by persona or category on purpose: ticketSummary's perPersona
    block reports every persona whatever the persona filter says, so it needs
    the whole set. Filtering here would quietly empty that block. */
export async function readTickets(kind: "inc" | "req", deps: QueryDeps = {}): Promise<FleetTicket[]> {
  const { rows } = await query(
    {
      name: `tickets.${kind}`,
      sql: `SELECT id, pid, uid, dept, cat, short, priority, state, [open],
                   [group], ageDays, week, sla
            FROM dbo.persona_vw_api_v1_ticket
            WHERE kind = @kind
            ORDER BY week, id`,
      params: { kind },
      schema: ticketRow,
    },
    deps,
  );
  return rows;
}

export async function readTitleRows(deps: QueryDeps = {}): Promise<TitleRow[]> {
  const { rows } = await query(
    {
      name: "title-mapping",
      sql: `SELECT t, dept, pid, conf, why
            FROM dbo.persona_vw_api_v1_title_mapping
            ORDER BY conf, t`,
      schema: titleRow,
    },
    deps,
  );
  return rows;
}
