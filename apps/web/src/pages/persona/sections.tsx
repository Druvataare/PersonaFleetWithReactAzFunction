/* Persona page sections, following the wireframe's screenPersona. */
import {
  healthLabel,
  healthTone,
  type AppException,
  type Baseline,
  type Migration,
  type PersonaId,
  type PersonaModel,
  type Pillars,
} from "@pfc/scoring";
import { Link } from "react-router";
import {
  BarList,
  BaselineHistogram,
  BinHistogram,
  BootScatter,
  ComplianceBySite,
  Donut,
  incidentCategoryColor,
  MeterBar,
  PersonaRing,
  PillarGauge,
  StackedAge,
  TrendArea,
} from "../../charts/index.ts";
import { AnimNum } from "../../components/AnimNum.tsx";
import { Avatar } from "../../components/Avatar.tsx";
import { Icon } from "../../components/Icon.tsx";
import { ChartType, Panel, Sect } from "../../components/ui.tsx";
import { ageByPriority, tally } from "../../lib/aggregate.ts";
import { TICKET_CATS } from "../../lib/categories.ts";
import { gb, toneColor } from "../../lib/format.ts";
import { personaTrend } from "../../lib/trend.ts";
import { MotionFrame } from "../../motion/clock.tsx";
import { bandColor, usePalette } from "../../theme/usePalette.ts";

const note = (text: string) => (
  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>{text}</div>
);

export function IdentityBand({ p }: { p: PersonaModel }) {
  const b = p.baseline;
  const tone = toneColor(healthTone(p.health));
  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
          <div style={{ textAlign: "right" }}>
            <div className="m" style={{ fontSize: 40, color: tone, lineHeight: 1 }}>
              <AnimNum value={Math.round(p.health)} />
            </div>
            <div style={{ fontSize: 11.5, color: tone }}>{healthLabel(p.health)}</div>
          </div>
          <div style={{ width: 110 }}>
            <PersonaRing
              pid={p.id}
              health={p.health}
              underPct={p.underPct}
              size={110}
              label={`${p.name} health ring`}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

const PILLAR_ROWS: ReadonlyArray<[keyof Pillars, string]> = [
  ["prov", "Provisioning vs baseline"],
  ["perf", "Boot time & stability"],
  ["comp", "Patch & OS compliance"],
  ["exp", "Disk headroom & battery"],
  ["sup", "ServiceNow ticket load"],
];

export function HealthComposition({ p }: { p: PersonaModel }) {
  const C = usePalette();
  return (
    <>
      <Sect>Health composition</Sect>
      <div className="g3">
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Five pillars, weighted for {p.name}
            <ChartType name="RADIAL GAUGE" />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 180, flexShrink: 0 }}>
              <PillarGauge pillars={p.pillars} size={180} />
            </div>
            <MotionFrame>
              <div style={{ flex: 1, minWidth: 220 }} role="list" aria-label="Pillar scores">
                {PILLAR_ROWS.map(([k, label], i) => (
                  <div
                    key={k}
                    role="listitem"
                    style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}
                  >
                    <div
                      className="truncate"
                      style={{ width: 150, fontSize: 12, color: "var(--dim)", flexShrink: 0 }}
                    >
                      {label}
                    </div>
                    <div className="bar-track">
                      <MeterBar pct={p.pillars[k]} color={bandColor(p.pillars[k], C)} index={i} />
                    </div>
                    <div
                      className="m"
                      style={{
                        fontSize: 12,
                        color: bandColor(p.pillars[k], C),
                        width: 26,
                        textAlign: "right",
                      }}
                    >
                      {Math.round(p.pillars[k])}
                    </div>
                    <div
                      className="m"
                      style={{ fontSize: 10, color: "var(--faint)", width: 28, textAlign: "right" }}
                    >
                      w{p.weights[k]}
                    </div>
                  </div>
                ))}
              </div>
            </MotionFrame>
          </div>
        </Panel>
        <Panel>
          <div className="eyebrow">
            Health trend · 12 weeks
            <ChartType name="AREA / SPARKLINE" />
          </div>
          <TrendArea series={personaTrend(p.id, p.health)} color={p.hue} />
          {note(
            "Direction matters more than the number. A flat line under 85 means the baseline is wrong, not the fleet.",
          )}
        </Panel>
        <Panel>
          <div className="eyebrow">
            Device health spread
            <ChartType name="BINNED HISTOGRAM" />
          </div>
          <BinHistogram
            values={p.devices.map((d) => d.score)}
            thresholds={[50, 60, 70, 80, 90]}
            binLabel={(bn) => Math.round(bn.x0 ?? 0)}
            binColor={(bn) => bandColor(((bn.x0 ?? 0) + (bn.x1 ?? 0)) / 2, C)}
            label="DEVICE HEALTH SCORE"
          />
          <div style={{ fontSize: 11, color: "var(--faint)" }}>
            A long left tail means a small group is dragging the persona average down.
          </div>
        </Panel>
      </div>
    </>
  );
}

export function Provisioning({ p }: { p: PersonaModel }) {
  const C = usePalette();
  const b: Baseline = p.baseline;
  return (
    <>
      <Sect>Provisioning against baseline</Sect>
      <div className="g3">
        <Panel>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="eyebrow">
              Memory
              <ChartType name="HISTOGRAM + THRESHOLD" />
            </div>
            <Link className="link" to={`/baselines/${p.id}`}>
              <Icon name="gear" size={12} /> Change
            </Link>
          </div>
          <BaselineHistogram
            values={p.devices.map((d) => d.ramGB)}
            baseValue={b.ramGB}
            label="RAM (GB)"
            unit="GB"
          />
        </Panel>
        <Panel>
          <div className="eyebrow">
            Storage
            <ChartType name="HISTOGRAM + THRESHOLD" />
          </div>
          <BaselineHistogram
            values={p.devices.map((d) => d.storageGB)}
            baseValue={b.storageGB}
            label="DISK (GB)"
            unit="GB"
          />
        </Panel>
        <Panel>
          <div className="eyebrow">
            CPU index
            <ChartType name="BINNED HISTOGRAM" />
          </div>
          <BinHistogram
            values={p.devices.map((d) => d.cpuScore)}
            thresholds={[40, 50, 60, 70, 80, 90]}
            binLabel={(bn) => Math.round(bn.x0 ?? 0)}
            binColor={(bn) => (((bn.x0 ?? 0) + (bn.x1 ?? 0)) / 2 >= b.cpuScore ? C.good : C.bad)}
            label="CPU BENCHMARK INDEX"
          />
        </Panel>
      </div>
    </>
  );
}

interface ExperienceProps {
  p: PersonaModel;
  cat: string | null;
  onCategory: (cat: string | null) => void;
}

export function ExperienceCompliance({ p, cat, onCategory }: ExperienceProps) {
  const C = usePalette();
  const color = incidentCategoryColor(C);
  const tickets = p.devices.flatMap((d) => d.tickets);
  const byCat = TICKET_CATS.map((c) => ({ key: c, n: tickets.filter((t) => t.cat === c).length })).filter(
    (d) => d.n,
  );
  const toggle = (c: string) => onCategory(cat === c ? null : c);
  return (
    <>
      <Sect>Experience and compliance</Sect>
      <div className="g3">
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Boot time against free disk
            <ChartType name="BUBBLE SCATTER" />
          </div>
          <BootScatter devices={p.devices} baseline={p.baseline} />
          {note(
            "Shaded zones breach the baseline. Large red dots in the bottom right are the devices to fix first.",
          )}
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Patch compliance by location
            <ChartType name="PROGRESS BAR CHART" />
          </div>
          <ComplianceBySite devices={p.devices} />
          {note("Bar length is device count; fill is the share patched.")}
        </Panel>
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div className="eyebrow">
              Ticket mix
              <ChartType name="DONUT" />
            </div>
            {cat && (
              <button type="button" className="link" onClick={() => onCategory(null)}>
                Clear
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 160, flexShrink: 0 }}>
              <Donut
                rows={byCat.map((d) => ({ ...d, color: color(d.key) }))}
                centerLabel="TICKETS"
                size={160}
                thickness={24}
                padAngle={0.02}
                dimOpacity={0.25}
                delayStep={70}
                centerSize={22}
                active={cat}
                onSelect={toggle}
                label="Ticket mix"
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }} role="group" aria-label="Ticket mix legend">
              {byCat.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={cat === d.key}
                  onClick={() => toggle(d.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "3px 0",
                    width: "100%",
                    opacity: !cat || cat === d.key ? 1 : 0.4,
                  }}
                >
                  <i className="dot" style={{ background: color(d.key) }} />
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{d.key}</span>
                  <span className="m" style={{ fontSize: 11, color: "var(--text)", marginLeft: "auto" }}>
                    {d.n}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function SupportLoad({ p }: { p: PersonaModel }) {
  const C = usePalette();
  const tickets = p.devices.flatMap((d) => d.tickets);
  const small = (text: string, first = false) => (
    <div
      style={{
        fontSize: 9.5,
        color: "var(--faint)",
        margin: first ? "0 0 6px" : "12px 0 6px",
        letterSpacing: ".1em",
      }}
    >
      {text}
    </div>
  );
  return (
    <>
      <Sect>Support load from ServiceNow</Sect>
      <div className="g3">
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Open tickets by age and priority
            <ChartType name="STACKED COLUMN" />
          </div>
          <StackedAge buckets={ageByPriority(tickets)} />
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            What people actually report
            <ChartType name="RANKED BAR" />
          </div>
          <BarList rows={tally(tickets, (t) => t.short).slice(0, 6)} color={C.warn} />
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Estate mix
            <ChartType name="RANKED BAR" />
          </div>
          {small("HARDWARE MODEL", true)}
          <BarList rows={tally(p.devices, (d) => d.model)} color={p.hue} />
          {small("LOCATION")}
          <BarList rows={tally(p.devices, (d) => d.site).slice(0, 6)} color={C.cyan} />
          {small("OS BUILD")}
          <BarList rows={tally(p.devices, (d) => d.osBuild)} color={C.accent} />
        </Panel>
      </div>
    </>
  );
}

interface MovementProps {
  p: PersonaModel;
  personas: PersonaModel[];
  migrations: Migration[];
  apps: Record<PersonaId, string[]>;
}

function AppList({ items, tone }: { items: string[]; tone: string }) {
  if (!items.length) return <div style={{ fontSize: 11, color: "var(--faint)" }}>None</div>;
  return (
    <>
      {items.map((a) => (
        <div
          key={a}
          className="truncate"
          style={{
            fontSize: 11,
            color: "var(--dim)",
            padding: "3px 7px",
            background: "var(--bg-deep)",
            borderRadius: 5,
            marginBottom: 4,
            borderLeft: `2px solid ${tone}`,
          }}
        >
          {a}
        </div>
      ))}
    </>
  );
}

function FlowCard({
  m,
  dir,
  personas,
  apps,
}: { m: Migration; dir: "in" | "out" } & Omit<MovementProps, "p" | "migrations">) {
  const otherId = dir === "in" ? m.from : m.to;
  const other = personas.find((x) => x.id === otherId);
  const remove = (apps[m.from] ?? []).filter((a) => !(apps[m.to] ?? []).includes(a));
  const add = (apps[m.to] ?? []).filter((a) => !(apps[m.from] ?? []).includes(a));
  const tone = dir === "in" ? "var(--good)" : "var(--warn)";
  return (
    <div
      style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: 11, marginBottom: 10 }}
      role="group"
      aria-label={`${dir === "in" ? "From" : "To"} ${other?.name ?? otherId}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <Avatar pid={otherId} size={22} color={other?.hue} />
        <span className="truncate" style={{ fontSize: 11.5, color: "var(--dim)" }}>
          {dir === "in" ? "From " : "To "}
          {other?.name ?? otherId}
        </span>
        <span className="m" style={{ marginLeft: "auto", fontSize: 13, color: tone }}>
          {dir === "in" ? "+" : "−"}
          {m.people}
        </span>
      </div>
      <div className="g2" style={{ gap: 10 }}>
        <div>
          <div style={{ fontSize: 9.5, color: "var(--warn)", marginBottom: 5, letterSpacing: ".1em" }}>
            REMOVED
          </div>
          <AppList items={remove} tone="var(--warn)" />
        </div>
        <div>
          <div style={{ fontSize: 9.5, color: "var(--good)", marginBottom: 5, letterSpacing: ".1em" }}>
            INSTALLED
          </div>
          <AppList items={add} tone="var(--good)" />
        </div>
      </div>
    </div>
  );
}

const stateTone = (s: AppException["state"]) =>
  s === "Pending" ? "var(--warn)" : s === "Approved" ? "var(--good)" : "var(--faint)";

export function MovementExceptions({ p, personas, migrations, apps }: MovementProps) {
  const C = usePalette();
  const inbound = migrations.filter((m) => m.to === p.id);
  const outbound = migrations.filter((m) => m.from === p.id);
  const exc = [...p.exceptions].sort(
    (a, b) => (a.state === "Pending" ? 0 : 1) - (b.state === "Pending" ? 0 : 1),
  );
  const worstApps = tally(p.exceptions, (e) => e.app).slice(0, 5);
  return (
    <>
      <Sect>Movement and app exceptions</Sect>
      <div className="g3">
        <Panel>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}
          >
            <div className="eyebrow">People moving</div>
            <span className="m" style={{ fontSize: 11, color: "var(--good)" }}>
              +{p.movedIn}
            </span>
            <span className="m" style={{ fontSize: 11, color: "var(--warn)" }}>
              −{p.movedOut}
            </span>
          </div>
          <div style={{ maxHeight: 290, overflowY: "auto" }}>
            {inbound.length || outbound.length ? (
              <>
                {inbound.map((m) => (
                  <FlowCard key={`in-${m.from}`} m={m} dir="in" personas={personas} apps={apps} />
                ))}
                {outbound.map((m) => (
                  <FlowCard key={`out-${m.to}`} m={m} dir="out" personas={personas} apps={apps} />
                ))}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--faint)" }}>
                Nobody moved in or out of this persona this quarter.
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div className="eyebrow">Exception holders</div>
            <span className="m" style={{ fontSize: 11, color: "var(--dim)" }}>
              {p.exceptions.length} people
            </span>
            {p.excPending > 0 && (
              <span className="m" style={{ fontSize: 11, color: "var(--warn)" }}>
                {p.excPending} pending
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", margin: "6px 0 2px" }}>
            Apps needed that sit outside the {p.name} catalogue.
          </div>
          {exc.length ? (
            <div role="list" aria-label="Exception holders">
              {exc.slice(0, 10).map((e) => (
                <div
                  key={e.id + e.user}
                  role="listitem"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 0",
                    borderTop: "1px solid var(--line-soft)",
                  }}
                >
                  <div className="truncate" style={{ width: 110, fontSize: 12 }}>
                    {e.user}
                  </div>
                  <div className="truncate" style={{ flex: 1, fontSize: 11.5, color: C.accent }}>
                    {e.app}
                  </div>
                  <span
                    className="m"
                    style={{
                      fontSize: 9.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      flexShrink: 0,
                      border: `1px solid ${e.state === "Rejected" ? "var(--line)" : stateTone(e.state)}`,
                      color: stateTone(e.state),
                    }}
                  >
                    {e.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--faint)", paddingTop: 10 }}>No exceptions raised.</div>
          )}
          {exc.length > 10 && (
            <div style={{ fontSize: 11, color: "var(--faint)", paddingTop: 9 }}>+ {exc.length - 10} more</div>
          )}
        </Panel>
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Exception pressure by app
            <ChartType name="RANKED BAR" />
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 12 }}>
            If one app keeps appearing, it probably belongs in the {p.name} catalogue.
          </div>
          {worstApps.length ? (
            <BarList rows={worstApps} color={C.fresh} />
          ) : (
            <div style={{ fontSize: 12, color: "var(--faint)" }}>
              Nothing requested outside the catalogue.
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
