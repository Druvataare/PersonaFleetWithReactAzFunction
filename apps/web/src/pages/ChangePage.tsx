/* 04 · WHAT IS SHIFTING — people moving between personas and apps requested outside
   a persona's catalogue. Follows the wireframe's screenMovement. */
import { useNavigate } from "react-router";
import { useExceptions, useMigrations } from "../api/queries.ts";
import { BarList, MigrationFlow } from "../charts/index.ts";
import { Avatar } from "../components/Avatar.tsx";
import { Icon } from "../components/Icon.tsx";
import { ChartType, ErrorMessage, Kpi, Loading, PageHead, Panel, Sect } from "../components/ui.tsx";
import { tally } from "@pfc/contract";
import { useFleetModel } from "../model/useFleetModel.ts";
import { usePalette } from "../theme/usePalette.ts";

export default function ChangePage() {
  const C = usePalette();
  const navigate = useNavigate();
  const { model, error: modelError } = useFleetModel();
  const migrations = useMigrations();
  const exceptions = useExceptions();

  const head = (
    <PageHead
      step="04 · WHAT IS SHIFTING"
      title="Change"
      sub="People move between personas and ask for apps outside their catalogue. Both are early signals that a persona definition has drifted from the work."
    />
  );

  const error = modelError ?? migrations.error ?? exceptions.error;
  if (error)
    return (
      <>
        {head}
        <ErrorMessage error={error} />
      </>
    );
  if (!model || !migrations.data || !exceptions.data)
    return (
      <>
        {head}
        <Loading />
      </>
    );

  const m = migrations.data;
  const exc = exceptions.data;
  const rows = [...model].sort((a, b) => b.movedIn + b.movedOut - (a.movedIn + a.movedOut));
  const dash = <span style={{ color: "var(--faint)" }}>—</span>;

  return (
    <>
      {head}
      <div className="g4" style={{ marginBottom: 18 }}>
        <Kpi value={m.length} label="Persona changes" />
        <Kpi value={m.reduce((a, x) => a + x.people, 0)} label="People reassigned" />
        <Kpi value={exc.length} label="App exceptions" />
        <Kpi value={exc.filter((e) => e.state === "Pending").length} label="Exceptions pending" tone="warn" />
      </div>

      <div className="gmain">
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Where people moved this quarter
            <ChartType name="SANKEY-STYLE FLOW" />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 8 }}>
            Ribbon width is the number of people. Which apps change is on each persona's page.
          </div>
          <MigrationFlow migrations={m} personas={model} />
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Most-requested apps outside a persona
            <ChartType name="RANKED BAR" />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 14 }}>
            Repeat requests usually mean the catalogue is wrong, not the person.
          </div>
          <BarList rows={tally(exc, (e) => e.app).slice(0, 8)} color={C.accent} />
        </Panel>
      </div>

      <Sect>By persona</Sect>
      <Panel pad={0}>
        <div className="tscroll">
          <table aria-label="Change by persona">
            <thead>
              <tr>
                <th className="l">Persona</th>
                <th>Moved in</th>
                <th>Moved out</th>
                <th>Net</th>
                <th>Exceptions</th>
                <th>Pending</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const net = p.movedIn - p.movedOut;
                return (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => navigate(`/personas/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/personas/${p.id}`);
                    }}
                  >
                    <td className="l">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar pid={p.id} size={24} color={p.hue} />
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="m" style={{ color: p.movedIn ? "var(--good)" : undefined }}>
                      {p.movedIn ? "+" + p.movedIn : dash}
                    </td>
                    <td className="m" style={{ color: p.movedOut ? "var(--warn)" : undefined }}>
                      {p.movedOut ? "−" + p.movedOut : dash}
                    </td>
                    <td
                      className="m"
                      style={{ color: net > 0 ? "var(--good)" : net < 0 ? "var(--warn)" : undefined }}
                    >
                      {net > 0 ? "+" + net : net || dash}
                    </td>
                    <td className="m" style={{ color: "var(--dim)" }}>
                      {p.exceptions.length}
                    </td>
                    <td className="m" style={{ color: p.excPending ? "var(--warn)" : undefined }}>
                      {p.excPending || dash}
                    </td>
                    <td style={{ paddingRight: 8 }}>
                      <Icon name="chevron" size={14} color="var(--faint)" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--faint)" }}>
        Counts only. Open a persona to see which apps are added or removed and who holds each exception.
      </div>
    </>
  );
}
