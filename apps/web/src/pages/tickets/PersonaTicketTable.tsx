import { cpuTier } from "@pfc/scoring";
import { Link, useNavigate } from "react-router";
import { Avatar } from "../../components/Avatar.tsx";
import { Icon } from "../../components/Icon.tsx";
import { Panel } from "../../components/ui.tsx";
import { gb, toneColor } from "../../lib/format.ts";
import type { PersonaTicketRow } from "../../lib/tickets.ts";

export function PersonaTicketTable({ rows }: { rows: PersonaTicketRow[] }) {
  const navigate = useNavigate();
  const sorted = [...rows].sort((a, b) => b.variance - a.variance);
  const maxV = Math.max(...sorted.map((r) => Math.abs(r.variance))) || 1;
  return (
    <Panel pad={0}>
      <div className="tscroll">
        <table aria-label="Persona ticket health">
          <thead>
            <tr>
              <th className="l">Persona</th>
              <th className="l">CPU</th>
              <th>RAM</th>
              <th>SSD</th>
              <th>Tickets</th>
              <th>Per user</th>
              <th>Baseline</th>
              <th>Variance</th>
              <th className="l">Baseline status</th>
              <th className="l">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const b = r.p.baseline;
              const w = Math.round((Math.abs(r.variance) / maxV) * 46);
              const pos = r.variance > 0;
              const varColor = pos ? "var(--bad)" : "var(--good)";
              return (
                <tr key={r.p.id} onClick={() => navigate(`/personas/${r.p.id}`)}>
                  <td className="l">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Avatar pid={r.p.id} size={20} color={r.p.hue} />
                      {r.p.name}
                    </span>
                  </td>
                  <td className="l m" style={{ color: "var(--dim)" }}>
                    {cpuTier(b.cpuScore).replace("Intel Core ", "")}
                  </td>
                  <td className="m" style={{ color: "var(--dim)" }}>
                    {b.ramGB}
                  </td>
                  <td className="m" style={{ color: "var(--dim)" }}>
                    {gb(b.storageGB)}
                  </td>
                  <td className="m">{r.tickets.toLocaleString()}</td>
                  <td className="m" style={{ color: toneColor(r.tone) }}>
                    {r.per.toFixed(2)}
                  </td>
                  <td className="m" style={{ color: "var(--faint)" }}>
                    {r.ceiling.toFixed(2)}
                  </td>
                  <td>
                    <div
                      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}
                    >
                      <div
                        style={{
                          width: 50,
                          display: "flex",
                          justifyContent: pos ? "flex-start" : "flex-end",
                        }}
                      >
                        <div
                          style={{ height: 11, width: Math.max(3, w), borderRadius: 2, background: varColor }}
                        />
                      </div>
                      <span className="m" style={{ color: varColor, width: 44, textAlign: "right" }}>
                        {pos ? "+" : ""}
                        {r.variance.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="l">
                    <span
                      className="m"
                      style={{
                        fontSize: 10,
                        padding: "3px 7px",
                        borderRadius: 4,
                        border: `1px solid ${toneColor(r.tone)}`,
                        color: toneColor(r.tone),
                      }}
                    >
                      {r.label}
                    </span>
                  </td>
                  <td className="l">
                    <Link
                      className="link"
                      to={`/personas/${r.p.id}`}
                      style={{ textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="chevron" size={11} /> Investigate
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
