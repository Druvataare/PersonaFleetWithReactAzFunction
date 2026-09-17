/* Endpoints called by the temporary step 3 API check page. */
import type {
  BaselinesResponse,
  CatalogResponse,
  DevicesResponse,
  ExceptionsResponse,
  MappingReviewResponse,
  MappingSummary,
  MigrationsResponse,
  PersonaChangesResponse,
  PersonasResponse,
  TicketSummary,
} from "./api/types.ts";

export interface Check {
  path: string;
  summarise: (body: never) => string;
}

const fmt = (n: number) => n.toLocaleString("en-GB");

export const CHECKS: Check[] = [
  {
    path: "/api/personas",
    summarise: (b: PersonasResponse) =>
      `${b.length} personas · ${fmt(b.reduce((a, p) => a + p.count, 0))} devices in estate`,
  },
  {
    path: "/api/baselines",
    summarise: (b: BaselinesResponse) =>
      `${Object.keys(b.defaults).length} baselines · ${Object.keys(b.weights).length} weight sets`,
  },
  {
    path: "/api/catalog",
    summarise: (b: CatalogResponse) =>
      `${Object.values(b.apps).flat().length} catalogue apps · ${b.ticketCategories.length} ticket categories · ${b.catalogItems.length} request items`,
  },
  {
    path: "/api/fleet/devices",
    summarise: (b: DevicesResponse) => `${Object.values(b).flat().length} sample devices`,
  },
  {
    path: "/api/mapping/summary",
    summarise: (b: MappingSummary) =>
      `${fmt(b.titlesMapped)} titles · avg ${b.avgConfidence.toFixed(2)}% · bands ${fmt(b.bands["100"])} / ${fmt(b.bands["50"])} / ${fmt(b.bands.low)}`,
  },
  {
    path: "/api/mapping/review?band=low",
    summarise: (b: MappingReviewResponse) => `${b.rows.length} rows shown of ${fmt(b.matched)} under 50%`,
  },
  {
    path: "/api/tickets/summary?type=inc",
    summarise: (b: TicketSummary) =>
      `${fmt(b.total)} incidents · ${fmt(b.open)} open · ${fmt(b.slaBreached)} past SLA · top ${b.byCategory[0]?.k}`,
  },
  {
    path: "/api/tickets/summary?type=req",
    summarise: (b: TicketSummary) =>
      `${fmt(b.total)} requests · ${fmt(b.open)} open · top ${b.byCategory[0]?.k}`,
  },
  {
    path: "/api/change/migrations",
    summarise: (b: MigrationsResponse) =>
      `${b.length} persona changes · ${fmt(b.reduce((a, m) => a + m.people, 0))} people`,
  },
  {
    path: "/api/change/exceptions",
    summarise: (b: ExceptionsResponse) =>
      `${b.length} app exceptions · ${b.filter((e) => e.state === "Pending").length} pending`,
  },
  {
    path: "/api/persona-changes",
    summarise: (b: PersonaChangesResponse) => `${b.length} changes logged this session`,
  },
];
