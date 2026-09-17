import { healthLabel, healthTone } from "@pfc/scoring";
import { Link, useParams } from "react-router";
import { AnimNum } from "../components/AnimNum.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { Icon } from "../components/Icon.tsx";
import { ComingSoon, ErrorMessage, Kpi, Loading, Panel, Sect } from "../components/ui.tsx";
import { gb, toneColor } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import NotFoundPage from "./NotFoundPage.tsx";

export default function PersonaDetailPage() {
  const { pid } = useParams();
  const { model, isLoading, error } = useFleetModel();

  if (error) return <ErrorMessage error={error} />;
  if (isLoading || !model) return <Loading />;
  const p = model.find((x) => x.id === pid);
  if (!p) return <NotFoundPage what={`Persona "${pid}"`} />;

  const b = p.baseline;
  const net = p.movedIn - p.movedOut;
  const worst = [...p.devices].sort((a, c) => a.score - c.score).slice(0, 5);

  return (
    <>
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 16,
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Avatar pid={p.id} size={44} color={p.hue} />
          </div>
          <div style={{ minWidth: 180 }}>
            <h2 style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-.01em", margin: 0 }}>{p.name}</h2>
            <div style={{ fontSize: 12.5, color: "var(--dim)" }}>{p.sub}</div>
            <div className="m" style={{ fontSize: 11, color: "var(--faint)", marginTop: 5 }}>
              Baseline · {b.ramGB}GB RAM · {gb(b.storageGB)} disk · CPU {b.cpuScore} · boot ≤{b.bootSec}s
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div
              className="m"
              style={{ fontSize: 40, lineHeight: 1, color: toneColor(healthTone(p.health)) }}
            >
              <AnimNum value={Math.round(p.health)} />
            </div>
            <div style={{ fontSize: 11.5, color: toneColor(healthTone(p.health)) }}>
              {healthLabel(p.health)}
            </div>
          </div>
        </div>
      </Panel>

      <div className="g4" style={{ marginBottom: 16 }}>
        <Kpi value={p.count} label="Devices" />
        <Kpi value={p.underCount} label="Below baseline" tone="bad" />
        <Kpi value={p.openTickets} label="Open tickets" tone="warn" />
        <Kpi value={p.ticketsPer100} dec={1} label="Tickets / 100" />
        <Kpi
          value={Math.round(p.avgBoot)}
          suf="s"
          label="Average boot"
          tone={p.avgBoot > b.bootSec ? "warn" : "good"}
        />
        <Kpi
          value={Math.round(p.patchPct)}
          suf="%"
          label="Patch compliant"
          tone={p.patchPct >= 90 ? "good" : "warn"}
        />
        <Kpi value={p.exceptions.length} label="App exceptions" />
        <Kpi
          value={net}
          pre={p.movedIn > 0 && net >= 0 ? "+" : ""}
          label="Net people moved"
          tone={net >= 0 ? "good" : "warn"}
        />
      </div>

      <Sect>Devices · worst first</Sect>
      <Panel pad={0}>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th className="l">Device</th>
                <th className="l">Assigned to</th>
                <th>Score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {worst.map((d) => (
                <tr key={d.id}>
                  <td className="l m" style={{ color: "var(--dim)" }}>
                    <Link to={`/personas/${p.id}/devices/${d.id}`} style={{ color: "inherit" }}>
                      {d.host}
                    </Link>
                  </td>
                  <td className="l">{d.user}</td>
                  <td className="m" style={{ color: toneColor(healthTone(d.score)) }}>
                    {Math.round(d.score)}
                  </td>
                  <td style={{ paddingRight: 8 }}>
                    <Icon name="chevron" size={14} color="var(--faint)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ComingSoon step={7}>
        Health composition, provisioning histograms, experience and compliance charts, support load, movement
        and exceptions, and the full searchable device table.
      </ComingSoon>
    </>
  );
}
