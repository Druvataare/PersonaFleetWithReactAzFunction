import { healthTone, type PersonaModel } from "@pfc/scoring";
import { Link, useNavigate } from "react-router";
import { Icon } from "../../components/Icon.tsx";
import { Panel, Sect } from "../../components/ui.tsx";
import { gb, toneColor } from "../../lib/format.ts";

interface DeviceTableProps {
  p: PersonaModel;
  cat: string | null;
  query: string;
  onQuery: (q: string) => void;
}

/** Sample devices, worst first, filtered by ticket category and search. Rows open the device page. */
export function DeviceTable({ p, cat, query, onQuery }: DeviceTableProps) {
  const navigate = useNavigate();
  const b = p.baseline;
  const q = query.toLowerCase();
  const rows = p.devices
    .filter((d) => (cat ? d.tickets.some((t) => t.cat === cat) : true))
    .filter((d) => (q ? (d.user + d.host + d.model + d.site).toLowerCase().includes(q) : true))
    .sort((a, c) => a.score - c.score);

  return (
    <>
      <Sect>{"Devices" + (cat ? " · filtered by " + cat + " tickets" : " · worst first")}</Sect>
      <Panel pad={0}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
            flexWrap: "wrap",
          }}
        >
          <div className="eyebrow">{p.devices.length} in sample · click a row for the device page</div>
          <div className="search" style={{ marginLeft: "auto" }}>
            <Icon name="search" size={13} color="var(--faint)" />
            <input
              id="devsearch"
              aria-label="Search user, host, model or site"
              placeholder="user, host, model, site"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="tscroll" style={{ maxHeight: 380, overflowY: "auto" }}>
          <table aria-label="Devices">
            <thead>
              <tr>
                <th className="l">Device</th>
                <th className="l">Assigned to</th>
                <th className="l">Model</th>
                <th>RAM</th>
                <th>Disk</th>
                <th>Boot</th>
                <th>Tickets</th>
                <th>Score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="l" style={{ padding: 26, color: "var(--faint)" }}>
                    No devices match. Clear the filter or search.
                  </td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} onClick={() => navigate(`/personas/${p.id}/devices/${d.id}`)}>
                    <td className="l m" style={{ color: "var(--dim)" }}>
                      <Link
                        to={`/personas/${p.id}/devices/${d.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.host}
                      </Link>
                    </td>
                    <td className="l">
                      {d.user}
                      <span style={{ color: "var(--faint)" }}> · {d.site}</span>
                    </td>
                    <td className="l" style={{ color: "var(--dim)" }}>
                      {d.model}
                    </td>
                    <td className="m" style={{ color: d.ramGB < b.ramGB ? "var(--bad)" : "var(--dim)" }}>
                      {d.ramGB}GB
                    </td>
                    <td
                      className="m"
                      style={{ color: d.storageGB < b.storageGB ? "var(--bad)" : "var(--dim)" }}
                    >
                      {gb(d.storageGB)}
                    </td>
                    <td className="m" style={{ color: d.bootSec > b.bootSec ? "var(--warn)" : "var(--dim)" }}>
                      {d.bootSec}s
                    </td>
                    <td className="m" style={{ color: d.tickets.length ? "var(--warn)" : "var(--faint)" }}>
                      {d.tickets.length}
                    </td>
                    <td className="m" style={{ color: toneColor(healthTone(d.score)) }}>
                      {Math.round(d.score)}
                    </td>
                    <td style={{ paddingRight: 8 }}>
                      <Icon name="chevron" size={14} color="var(--faint)" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
