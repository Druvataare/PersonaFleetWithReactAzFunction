import { gradeTicketLoad, type PersonaModel } from "@pfc/scoring";
import type { PersonaTicketCount } from "@pfc/contract";

export interface PersonaTicketRow {
  p: PersonaModel;
  tickets: number;
  per: number;
  ceiling: number;
  variance: number;
  label: string;
  tone: "good" | "warn" | "bad";
}

/** Each persona's ticket load graded against its ticket ceiling (the Baselines slider). */
export function personaTicketRows(
  model: readonly PersonaModel[],
  counts: readonly PersonaTicketCount[],
): PersonaTicketRow[] {
  return model.map((p) => {
    const tickets = counts.find((c) => c.id === p.id)?.tickets ?? 0;
    const g = gradeTicketLoad(tickets, p.count, p.baseline);
    return { p, tickets, per: g.per, ceiling: g.ceiling, variance: g.variance, label: g.label, tone: g.tone };
  });
}
