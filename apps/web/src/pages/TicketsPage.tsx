/* 03 · WHAT IT COSTS — incidents and service requests, graded per user against each
   persona's ticket ceiling. Follows the wireframe's screenTickets. */
import { ticketBaselinePerUser, ticketStatus } from "@pfc/scoring";
import { useTicketSummary } from "../api/queries.ts";
import type { TicketKind } from "../api/types.ts";
import { BarList, Donut, StackedAge, ticketCategoryColor, WeekBars } from "../charts/index.ts";
import { LegendList } from "../components/LegendList.tsx";
import { ChartType, Chip, ErrorMessage, Kpi, Loading, PageHead, Panel, Sect } from "../components/ui.tsx";
import { useFleetModel } from "../model/useFleetModel.ts";
import { Replay } from "../motion/clock.tsx";
import { useUi } from "../store/ui.ts";
import { usePalette } from "../theme/usePalette.ts";
import { personaTicketRows } from "../lib/tickets.ts";
import { PersonaTicketTable } from "./tickets/PersonaTicketTable.tsx";

const MODES: ReadonlyArray<[TicketKind, string]> = [
  ["inc", "Incidents"],
  ["req", "Service requests"],
];

export default function TicketsPage() {
  const C = usePalette();
  const kind = useUi((s) => s.ticketKind);
  const persona = useUi((s) => s.ticketPersona);
  const cat = useUi((s) => s.ticketCatFilter);
  const set = useUi((s) => s.set);
  const { model, error: modelError } = useFleetModel();
  const summary = useTicketSummary(kind, persona, cat);
  const inc = kind === "inc";

  const tools = (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        {MODES.map(([k, label]) => (
          <Chip
            key={k}
            on={kind === k}
            style={{ padding: "9px 14px" }}
            onClick={() => set({ ticketKind: k, ticketCatFilter: null })}
          >
            {label}
          </Chip>
        ))}
      </div>
      <label className="eyebrow" htmlFor="tpsel">
        Persona
      </label>
      <select
        id="tpsel"
        className="theme-sel"
        value={persona}
        onChange={(e) => set({ ticketPersona: e.target.value })}
      >
        <option value="all">All</option>
        {model?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {cat && (
        <Chip on onClick={() => set({ ticketCatFilter: null })}>
          {cat} ✕
        </Chip>
      )}
    </>
  );

  const head = (
    <PageHead
      step="03 · WHAT IT COSTS"
      title="Tickets"
      sub={
        inc
          ? "Incidents raised against the fleet, graded per user against each persona's ticket ceiling. A persona over its ceiling on a strong device is a support problem, not a hardware one."
          : "Service requests rather than faults. Repeated memory and storage requests are usually a baseline set too low."
      }
      tools={tools}
    />
  );

  const error = modelError ?? summary.error;
  if (error)
    return (
      <>
        {head}
        <ErrorMessage error={error} />
      </>
    );
  if (!model || !summary.data)
    return (
      <>
        {head}
        <Loading />
      </>
    );

  const s = summary.data;
  const scope = persona === "all" ? model : model.filter((p) => p.id === persona);
  const users = scope.reduce((a, p) => a + p.count, 0);
  const per = users ? s.total / users : 0;
  const avgBase = scope.length
    ? scope.reduce((a, p) => a + ticketBaselinePerUser(p.baseline), 0) / scope.length
    : 0;
  const rows = personaTicketRows(model, s.perPersona);
  const scoped = rows.filter((r) => persona === "all" || r.p.id === persona);
  const over = scoped.filter((r) => r.variance > r.ceiling * 0.5).length;
  const worst = scoped.length ? Math.max(...scoped.map((r) => r.variance)) : 0;
  const label = inc ? "incidents" : "requests";
  const top = s.byCategory[0];
  const color = ticketCategoryColor(C);
  const toggleCat = (k: string) => set({ ticketCatFilter: cat === k ? null : k });

  return (
    /* Like the wireframe, charts replay when the mode or a filter changes. */
    <Replay on={[kind, persona, cat]}>
      {head}

      <div className="g6" style={{ marginBottom: 16 }}>
        <Kpi value={s.total} label={"Total " + label} />
        <Kpi value={s.uniqueRequestors} label="Unique requestors" />
        <Kpi value={per} dec={2} label="Per user" tone={ticketStatus(per, avgBase).tone} />
        <Kpi value={avgBase} dec={2} label="Ticket baseline" />
        <Kpi value={over} label="Personas over baseline" tone={over ? "bad" : "good"} />
        <Kpi
          value={worst}
          dec={2}
          pre={worst > 0 ? "+" : ""}
          label="Worst variance"
          tone={worst > 0 ? "bad" : "good"}
        />
      </div>

      <div className="g4" style={{ marginBottom: 16 }}>
        <Kpi value={s.open} label="Still open" tone="warn" />
        <Kpi
          value={s.total - s.open}
          label={inc ? "Resolved or closed" : "Fulfilled or rejected"}
          tone="good"
        />
        <Kpi value={s.slaBreached} label="Past SLA age" tone={s.slaBreached ? "bad" : "good"} />
        <Panel style={{ padding: "14px 16px" }}>
          <div role="group" aria-label={inc ? "Top category" : "Top catalog item"}>
            <div className="eyebrow">{inc ? "Top category" : "Top catalog item"}</div>
            <div className="truncate" style={{ fontSize: 20, fontWeight: 650, marginTop: 10 }}>
              {top ? top.k : "—"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 6 }}>
              {top ? `${top.n.toLocaleString()} of ${s.total.toLocaleString()}` : "—"}
            </div>
          </div>
        </Panel>
      </div>

      <Sect>Distribution</Sect>
      <div className="gmain">
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {inc ? "Ticket distribution by category" : "Ticket distribution by catalog item"}
            <ChartType name="DONUT" />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 190, flexShrink: 0 }}>
              <Donut
                rows={s.byCategory.map((d) => ({ key: d.k, n: d.n, color: color(d.k) }))}
                centerLabel="TICKETS"
                delayStep={55}
                active={cat}
                onSelect={toggleCat}
                label="Ticket distribution"
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <LegendList
                rows={s.byCategory.map((d) => ({ key: d.k, label: d.k, n: d.n, color: color(d.k) }))}
                active={cat}
                onSelect={toggleCat}
                pctDecimals={1}
                label="Ticket distribution legend"
              />
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Top 10 departments by ticket
            <ChartType name="RANKED BAR" />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 12 }}>
            Where the load actually lands.
          </div>
          <BarList rows={s.topDepartments} color={C.accent} />
        </Panel>
      </div>

      <div className="g2" style={{ marginTop: 16 }}>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Volume by week
            <ChartType name="COLUMN CHART" />
          </div>
          <WeekBars series={s.weeks} color={inc ? C.warn : C.cyan} />
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Age and priority
            <ChartType name="STACKED COLUMN" />
          </div>
          <StackedAge buckets={s.ageByPriority} />
          <div style={{ fontSize: 11, color: "var(--faint)" }}>
            A tall right-hand bar means things are ageing, not arriving.
          </div>
        </Panel>
      </div>

      <Sect>Persona ticket health</Sect>
      <PersonaTicketTable rows={scoped} />
      <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--faint)" }}>
        Per user is tickets divided by devices in the persona. The baseline column is the ticket ceiling from
        the Baselines page — change it there and every row here re-grades.
      </div>
    </Replay>
  );
}
