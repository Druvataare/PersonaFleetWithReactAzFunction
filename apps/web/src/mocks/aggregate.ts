/* Server-side aggregations the real API will run in SQL. Logic follows the
   wireframe's confidenceBlock, reviewTable and screenTickets. */
import { confBand, type ConfidenceBand, type PersonaDef } from "@pfc/scoring";
import { ageByPriority, tally } from "../lib/aggregate.ts";

export { ageByPriority, tally };
import type {
  FleetTicket,
  MappingReviewResponse,
  MappingSummary,
  TicketKind,
  TicketSummary,
  TitleRow,
} from "../api/types.ts";

export const REVIEW_LIMIT = 150;

const scopeTitles = (rows: readonly TitleRow[], persona: string | null) =>
  !persona || persona === "all" ? rows : rows.filter((r) => r.pid === persona);

export function mappingSummary(
  rows: readonly TitleRow[],
  personas: readonly PersonaDef[],
  persona: string | null,
): MappingSummary {
  const scoped = scopeTitles(rows, persona);
  const bands: Record<ConfidenceBand, number> = { "100": 0, "50": 0, low: 0 };
  let confTotal = 0;
  scoped.forEach((r) => {
    bands[confBand(r.conf)]++;
    confTotal += r.conf;
  });
  const byPersona = personas
    .map((p) => ({ k: p.id, n: scoped.filter((r) => r.pid === p.id).length }))
    .filter((d) => d.n > 0);
  return {
    avgConfidence: scoped.length ? confTotal / scoped.length : 0,
    distinctTitles: new Set(scoped.map((r) => r.t)).size,
    titlesMapped: scoped.length,
    bands,
    byPersona,
    byDept: byPersona.map((d) => ({
      k: d.k,
      n: new Set(scoped.filter((r) => r.pid === d.k).map((r) => r.dept + "|" + r.t)).size,
    })),
  };
}

const isBand = (v: string | null): v is ConfidenceBand => v === "100" || v === "50" || v === "low";

/** Lowest confidence first. Without a band, everything below 100% is listed. */
export function mappingReview(
  rows: readonly TitleRow[],
  persona: string | null,
  band: string | null,
  q: string | null,
): MappingReviewResponse {
  let matched = scopeTitles(rows, persona).filter((r) =>
    isBand(band) ? confBand(r.conf) === band : r.conf < 100,
  );
  if (q) {
    const needle = q.toLowerCase();
    matched = matched.filter((r) => (r.t + r.dept).toLowerCase().includes(needle));
  }
  const sorted = [...matched].sort((a, b) => a.conf - b.conf);
  return { rows: sorted.slice(0, REVIEW_LIMIT), matched: matched.length };
}

export function ticketSummary(
  set: readonly FleetTicket[],
  personas: readonly PersonaDef[],
  kind: TicketKind,
  persona: string | null,
  category: string | null,
): TicketSummary {
  let rows = set;
  if (persona && persona !== "all") rows = rows.filter((t) => t.pid === persona);
  if (category) rows = rows.filter((t) => t.cat === category);
  return {
    kind,
    total: rows.length,
    uniqueRequestors: new Set(rows.map((t) => t.uid)).size,
    open: rows.filter((t) => t.open).length,
    slaBreached: rows.filter((t) => t.sla).length,
    byCategory: tally(rows, (t) => t.cat),
    topDepartments: tally(rows, (t) => t.dept).slice(0, 10),
    weeks: Array.from({ length: 12 }, (_, w) => rows.filter((t) => t.week === 11 - w).length),
    ageByPriority: ageByPriority(rows),
    perPersona: personas.map((p) => {
      const mine = set.filter((t) => t.pid === p.id);
      return {
        id: p.id,
        tickets: mine.length,
        open: mine.filter((t) => t.open).length,
        sla: mine.filter((t) => t.sla).length,
      };
    }),
  };
}
