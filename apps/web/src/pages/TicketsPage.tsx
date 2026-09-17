import { useTicketSummary } from "../api/queries.ts";
import type { TicketKind } from "../api/types.ts";
import { Chip, ComingSoon, ErrorMessage, Kpi, Loading, PageHead } from "../components/ui.tsx";
import { useUi } from "../store/ui.ts";

const MODES: ReadonlyArray<[TicketKind, string]> = [
  ["inc", "Incidents"],
  ["req", "Service requests"],
];

export default function TicketsPage() {
  const kind = useUi((s) => s.ticketKind);
  const set = useUi((s) => s.set);
  const { data, error } = useTicketSummary(kind, "all", null);

  return (
    <>
      <PageHead
        step="03 · WHAT IT COSTS"
        title="Tickets"
        sub={
          kind === "inc"
            ? "Incidents raised against the fleet, graded per user against each persona's ticket ceiling. A persona over its ceiling on a strong device is a support problem, not a hardware one."
            : "Service requests rather than faults. Repeated memory and storage requests are usually a baseline set too low."
        }
        tools={
          <div style={{ display: "flex", gap: 6 }}>
            {MODES.map(([k, label]) => (
              <Chip
                key={k}
                on={kind === k}
                style={{ padding: "9px 14px" }}
                onClick={() => set({ ticketKind: k })}
              >
                {label}
              </Chip>
            ))}
          </div>
        }
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="g4">
          <Kpi value={data.total} label={kind === "inc" ? "Total incidents" : "Total requests"} />
          <Kpi value={data.uniqueRequestors} label="Unique requestors" />
          <Kpi value={data.open} label="Still open" tone="warn" />
          <Kpi value={data.slaBreached} label="Past SLA age" tone={data.slaBreached ? "bad" : "good"} />
        </div>
      )}
      <ComingSoon step={9}>
        Persona filter, per-user load against the ticket baseline, category donut, top departments, weekly
        volume, age and priority, and the persona ticket-health table.
      </ComingSoon>
    </>
  );
}
