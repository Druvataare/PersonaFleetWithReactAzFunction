/* GET /api/tickets/summary — the Tickets page's totals, trend and breakdowns.

   What these tickets are is not obvious and the page says so (AD-10): they
   are remediation events from the endpoint-fix lifecycle, not an ITSM feed,
   with priority derived from outcome and SLA breach derived from age against
   a stated target. This endpoint only reduces them. */
import { app, type HttpRequest } from "@azure/functions";
import { ticketSummary, type TicketKind, type TicketSummary } from "@pfc/contract";
import type { QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";
import { readPersonas } from "../reference/personas.ts";
import { readTickets } from "./rows.ts";

const param = (request: HttpRequest, name: string): string | null => {
  const value = request.query.get(name)?.trim();
  return value ? value : null;
};

/** The front end sends `type`; anything else is an incident. */
export const toKind = (value: string | null): TicketKind => (value === "req" ? "req" : "inc");

export async function readTicketSummary(
  kind: TicketKind,
  persona: string | null,
  category: string | null,
  deps: QueryDeps = {},
): Promise<TicketSummary> {
  const [tickets, personas] = await Promise.all([readTickets(kind, deps), readPersonas(deps)]);
  /* The persona and category filters are applied inside ticketSummary, which
     also keeps the unfiltered set for perPersona. Filtering before this call
     would silently empty that block. */
  return ticketSummary(tickets, personas, kind, persona, category);
}

app.http("tickets-summary", {
  route: "tickets/summary",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("tickets summary", (request) =>
    readTicketSummary(toKind(param(request, "type")), param(request, "persona"), param(request, "cat")),
  ),
});
