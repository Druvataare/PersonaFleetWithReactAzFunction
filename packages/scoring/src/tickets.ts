import type { Baseline, Tone } from "./types.ts";

export type TicketStatusLabel = "Within baseline" | "Near baseline" | "Over baseline";

/** Per-user ticket ceiling derived from the baseline's tickets-per-100-devices value. */
export const ticketBaselinePerUser = (b: Pick<Baseline, "ticketsPer100">): number => b.ticketsPer100 / 100;

/** At or under the ceiling is within; up to 1.5× is near; beyond that is over. */
export function ticketStatus(perUser: number, ceiling: number): { label: TicketStatusLabel; tone: Tone } {
  return perUser <= ceiling
    ? { label: "Within baseline", tone: "good" }
    : perUser <= ceiling * 1.5
      ? { label: "Near baseline", tone: "warn" }
      : { label: "Over baseline", tone: "bad" };
}

export interface TicketGrade {
  /** Tickets per user (device) in the persona. */
  per: number;
  /** Per-user ceiling. */
  ceiling: number;
  /** per − ceiling; positive means over. */
  variance: number;
  label: TicketStatusLabel;
  tone: Tone;
}

/** Grades a persona's ticket volume against its ceiling. */
export function gradeTicketLoad(
  tickets: number,
  users: number,
  b: Pick<Baseline, "ticketsPer100">,
): TicketGrade {
  const per = users ? tickets / users : 0;
  const ceiling = ticketBaselinePerUser(b);
  return { per, ceiling, variance: per - ceiling, ...ticketStatus(per, ceiling) };
}
