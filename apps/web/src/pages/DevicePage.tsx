/* Device page: one device against its persona baseline, following the wireframe's screenDevice. */
import { healthTone, type PersonaModel, type ScoredDevice } from "@pfc/scoring";
import { useParams } from "react-router";
import { useCatalog, useRaiseProvisioningRequest } from "../api/queries.ts";
import { Bullet } from "../charts/index.ts";
import { AnimNum } from "../components/AnimNum.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { Icon } from "../components/Icon.tsx";
import { ChartType, ErrorMessage, Loading, Panel } from "../components/ui.tsx";
import { entitlement, suggestedActions } from "../lib/deviceActions.ts";
import { toneColor } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import NotFoundPage from "./NotFoundPage.tsx";

export default function DevicePage() {
  const { pid, did } = useParams();
  const { model, isLoading, error } = useFleetModel();
  const catalog = useCatalog();

  const loadError = error ?? catalog.error;
  if (loadError) return <ErrorMessage error={loadError} />;
  if (isLoading || !model || !catalog.data) return <Loading />;
  const p = model.find((x) => x.id === pid);
  const d = p?.devices.find((x) => x.id === did);
  if (!p || !d) return <NotFoundPage what={`Device "${did}"`} />;

  /* Keyed by device so a raised request does not carry over to another device. */
  return <DeviceView key={d.id} p={p} d={d} catalogue={catalog.data.apps[p.id] ?? []} />;
}

const PRIORITY_TONE: Record<string, string> = { P1: "var(--bad)", P2: "var(--warn)" };

function DeviceView({ p, d, catalogue }: { p: PersonaModel; d: ScoredDevice; catalogue: string[] }) {
  const b = p.baseline;
  const raise = useRaiseProvisioningRequest();
  const apps = entitlement(d.installed, catalogue);
  const actions = suggestedActions(d, b, p.name, apps);

  const columns = [
    {
      title: "Entitled & installed",
      items: apps.entitled,
      tone: "var(--good)",
      note: "Matches persona catalogue",
    },
    {
      title: "Missing from device",
      items: apps.missing,
      tone: "var(--warn)",
      note: "Will be pushed on next sync",
    },
    {
      title: "Outside persona",
      items: apps.outside,
      tone: "var(--fresh)",
      note: "Needs an exception to stay",
    },
  ];

  return (
    <div className="gmain">
      <div>
        <Panel style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
                background: "var(--panel2)",
                border: "1px solid var(--line)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Avatar pid={p.id} size={36} color={p.hue} />
            </div>
            <div style={{ minWidth: 180 }}>
              <h2 style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>{d.user}</h2>
              <div style={{ fontSize: 12, color: "var(--faint)" }}>
                {d.email} · {d.site}
              </div>
              <div className="m" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                {d.host} · {d.model} · {d.osBuild} · seen {d.lastSeen}d ago
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="m" style={{ fontSize: 32, color: toneColor(healthTone(d.score)) }}>
                <AnimNum value={Math.round(d.score)} />
              </div>
              <div className="eyebrow">Device health</div>
            </div>
          </div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Actual against {p.name} baseline
            <ChartType name="BULLET CHART" />
          </div>
          <div className="g2" style={{ gap: "0 26px" }}>
            <Bullet
              label="Memory"
              actual={d.ramGB}
              target={b.ramGB}
              max={Math.max(b.ramGB, d.ramGB) * 1.15}
              unit="GB"
              icon="ram"
            />
            <Bullet
              label="Storage"
              actual={d.storageGB}
              target={b.storageGB}
              max={Math.max(b.storageGB, d.storageGB) * 1.15}
              unit="GB"
              icon="disk"
            />
            <Bullet label="CPU index" actual={d.cpuScore} target={b.cpuScore} max={100} unit="" icon="cpu" />
            <Bullet label="Free disk" actual={d.freePct} target={b.freePct} max={100} unit="%" icon="disk" />
            <Bullet
              label="Boot time"
              actual={d.bootSec}
              target={b.bootSec}
              max={Math.max(b.bootSec, d.bootSec) * 1.15}
              unit="s"
              invert
              icon="clock"
            />
            <Bullet
              label="Battery health"
              actual={d.batteryPct}
              target={b.batteryPct}
              max={100}
              unit="%"
              icon="battery"
            />
            <Bullet
              label="Crashes / 30d"
              actual={d.crashes}
              target={b.crashes}
              max={Math.max(b.crashes, d.crashes) + 2}
              unit=""
              invert
              icon="alert"
            />
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Application entitlement against persona
          </div>
          <div className="g3" style={{ gap: 14 }}>
            {columns.map((c) => (
              <div key={c.title} role="group" aria-label={c.title}>
                <div style={{ fontSize: 11, color: c.tone, marginBottom: 8 }}>{c.title}</div>
                {c.items.length ? (
                  c.items.map((a) => (
                    <div key={a} className="applet" style={{ borderLeft: `2px solid ${c.tone}` }}>
                      {a}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>None</div>
                )}
                <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 6 }}>{c.note}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div>
        <Panel style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            ServiceNow · this device
          </div>
          {d.tickets.length ? (
            <div role="list" aria-label="Tickets for this device">
              {d.tickets.map((t) => (
                <div
                  key={t.number + t.short}
                  role="listitem"
                  style={{
                    borderLeft: `2px solid ${PRIORITY_TONE[t.priority] ?? "var(--accent)"}`,
                    paddingLeft: 11,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="m" style={{ fontSize: 11 }}>
                      {t.number}
                    </span>
                    <span
                      className="m"
                      style={{
                        fontSize: 9,
                        color: "var(--faint)",
                        border: "1px solid var(--line)",
                        borderRadius: 4,
                        padding: "1px 4px",
                      }}
                    >
                      {t.priority}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--faint)", marginLeft: "auto" }}>
                      {t.ageDays}d
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3 }}>{t.short}</div>
                  <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>
                    {t.cat} · {t.state} · {t.group}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--faint)" }}>No tickets in the last 90 days.</div>
          )}

          {raise.data && (
            <div
              role="status"
              style={{
                background: "var(--hover)",
                border: "1px solid var(--good)",
                borderRadius: 8,
                padding: 10,
                fontSize: 11.5,
                color: "var(--good)",
                marginBottom: 12,
              }}
            >
              {raise.data.number} created and routed to {raise.data.group}.
            </div>
          )}
          {raise.error && (
            <div role="alert" style={{ fontSize: 11.5, color: "var(--bad)", marginBottom: 12 }}>
              Could not raise the request: {raise.error.message}. Try again.
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={raise.isPending}
            onClick={() => raise.mutate(d.id)}
          >
            <Icon name="ticket" size={13} />
            {raise.isPending ? "Raising request…" : "Raise provisioning request"}
          </button>
        </Panel>

        <Panel>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Suggested actions
          </div>
          {actions.length ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Suggested actions">
              {actions.map((a, i) => (
                <li
                  key={a}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 12,
                    color: "var(--dim)",
                    marginBottom: 9,
                  }}
                >
                  <span
                    className="m"
                    style={{ fontSize: 10, color: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ fontSize: 12, color: "var(--faint)" }}>
              Device meets every baseline. No action needed.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
