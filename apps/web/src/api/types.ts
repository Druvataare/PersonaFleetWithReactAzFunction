/* API contract: shapes returned by /api/* (the mock API today, Azure Functions later). */
import type {
  AppException,
  Baseline,
  ConfidenceBand,
  Device,
  Migration,
  PersonaDef,
  PersonaId,
  Priority,
  Weights,
} from "@pfc/scoring";

export type TicketKind = "inc" | "req";

/** One HR job title mapped to a persona, with model confidence (0–100). */
export interface TitleRow {
  t: string;
  dept: string;
  pid: PersonaId;
  conf: number;
  why: string;
}

/** An incident or service request from ServiceNow. */
export interface FleetTicket {
  id: string;
  pid: PersonaId;
  uid: string;
  dept: string;
  cat: string;
  short: string;
  priority: Priority;
  state: string;
  open: boolean;
  group: string;
  ageDays: number;
  /** Weeks ago, 0–11. */
  week: number;
  sla: boolean;
}

export interface PersonaChange {
  date: string;
  id: string;
  user: string;
  from: PersonaId;
  to: PersonaId;
}

export interface KeyCount {
  k: string;
  n: number;
}

/* ---------- responses ---------- */

export type PersonasResponse = PersonaDef[];

export interface BaselinesResponse {
  defaults: Record<PersonaId, Baseline>;
  weights: Record<PersonaId, Weights>;
}

export interface CatalogResponse {
  apps: Record<PersonaId, string[]>;
  tasksAutomated: Record<PersonaId, number>;
  onboardingDays: Record<PersonaId, number>;
  ticketCategories: string[];
  catalogItems: string[];
}

export type DevicesResponse = Record<PersonaId, Device[]>;

export interface MappingSummary {
  avgConfidence: number;
  distinctTitles: number;
  titlesMapped: number;
  bands: Record<ConfidenceBand, number>;
  /** Job titles per persona (persona order, non-zero only). */
  byPersona: KeyCount[];
  /** Distinct department + title pairs per persona. */
  byDept: KeyCount[];
}

export interface MappingReviewResponse {
  rows: TitleRow[];
  /** Rows matching before the 150-row limit. */
  matched: number;
}

export interface AgeBucket {
  label: string;
  /** Count per priority P1–P4. */
  vals: [number, number, number, number];
  total: number;
}

export interface PersonaTicketCount {
  id: PersonaId;
  tickets: number;
  open: number;
  sla: number;
}

export interface TicketSummary {
  kind: TicketKind;
  total: number;
  uniqueRequestors: number;
  open: number;
  slaBreached: number;
  byCategory: KeyCount[];
  topDepartments: KeyCount[];
  /** Oldest week first: index 0 is 11 weeks ago, index 11 is this week. */
  weeks: number[];
  ageByPriority: AgeBucket[];
  /** Whole set for this kind, ignoring persona and category filters. */
  perPersona: PersonaTicketCount[];
}

export type MigrationsResponse = Migration[];
export type ExceptionsResponse = AppException[];
export type PersonaChangesResponse = PersonaChange[];

export interface PersonaChangeRequest {
  userId: string;
  to: PersonaId;
}

export interface PersonaChangeResponse {
  change: PersonaChange;
}

export interface ProvisioningRequestResponse {
  number: string;
  group: string;
}

export interface ApiError {
  error: string;
}
