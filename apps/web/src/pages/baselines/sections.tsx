/* Baselines page sections, following the wireframe's screenBaseline and fitBlock. */
import {
  cpuTier,
  FIT_KINDS,
  healthTone,
  type Baseline,
  type PersonaFit,
  type PersonaId,
  type PersonaModel,
} from "@pfc/scoring";
import { Donut, FitStack, PersonaRing } from "../../charts/index.ts";
import { AnimNum } from "../../components/AnimNum.tsx";
import { Avatar } from "../../components/Avatar.tsx";
import { Icon } from "../../components/Icon.tsx";
import { ChartType, Panel } from "../../components/ui.tsx";
import { BASELINE_FIELDS, fieldValue, fitTotals, pctOf } from "../../lib/baselines.ts";
import { gb, toneColor } from "../../lib/format.ts";
import type { Palette } from "../../theme/themes.ts";
import { bandColor, usePalette } from "../../theme/usePalette.ts";

export function PersonaStrip({
  personas,
  focus,
  onPick,
}: {
  personas: PersonaModel[];
  focus: PersonaId;
  onPick: (id: PersonaId) => void;
}) {
  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}
      role="group"
      aria-label="Choose persona"
    >
      {personas.map((x) => {
        const on = x.id === focus;
        return (
          <button
            key={x.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(x.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 9,
              cursor: "pointer",
              background: on ? "var(--hover)" : "var(--panel)",
              border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
            }}
          >
            <Avatar pid={x.id} size={20} color={x.hue} />
            <span style={{ fontSize: 12, whiteSpace: "nowrap", color: on ? "var(--text)" : "var(--dim)" }}>
              {x.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FitTiles({ rows, personaCount }: { rows: PersonaFit[]; personaCount: number }) {
  const { tot, total } = fitTotals(rows);
  const tiles = [
    { label: "Total devices", value: total, color: "var(--text)", sub: `across ${personaCount} personas` },
    ...FIT_KINDS.map(({ key, label, tone }) => ({
      label,
      value: tot[key],
      color: toneColor(tone),
      sub: `${pctOf(tot[key], total)} of estate`,
    })),
  ];
  return (
    <div className="g5">
      {tiles.map((t) => (
        <div key={t.label} className="statbox" role="group" aria-label={t.label}>
          <div className="eyebrow">{t.label}</div>
          <div className="stat-v" style={{ color: t.color, fontSize: 30, marginTop: 8 }}>
            <AnimNum value={t.value} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 6 }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

interface ContractProps {
  p: PersonaModel;
  defaults: Baseline;
  dirty: boolean;
  onChange: (field: keyof Baseline, value: number) => void;
  onReset: () => void;
}

export function ContractSliders({ p, defaults, dirty, onChange, onReset }: ContractProps) {
  const b = p.baseline;
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <div className="eyebrow">Baseline contract · {p.name}</div>
        {dirty && (
          <span className="m" style={{ fontSize: 10, color: "var(--warn)" }}>
            EDITED
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onReset}
          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 9px" }}
        >
          <Icon name="reset" size={11} /> Reset
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 20 }}>
        Every minimum and every ceiling for this persona. The ticket ceiling at the bottom is what grades the
        Tickets page.
      </div>
      {BASELINE_FIELDS.map((f) => {
        const edited = b[f.k] !== defaults[f.k];
        const id = `slider-${f.k}`;
        return (
          <div
            key={f.k}
            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}
          >
            <label
              htmlFor={id}
              style={{
                width: 190,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--dim)",
                flexShrink: 0,
              }}
            >
              <Icon name={f.icon} size={13} />
              {f.label}
            </label>
            <div style={{ flex: 1, minWidth: 110 }}>
              <input
                id={id}
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={b[f.k]}
                aria-valuetext={fieldValue(f, b[f.k])}
                onChange={(e) => onChange(f.k, Number(e.target.value))}
              />
            </div>
            <output
              htmlFor={id}
              className="m"
              style={{
                fontSize: 13,
                color: edited ? "var(--accent)" : "var(--text)",
                width: 70,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {fieldValue(f, b[f.k])}
            </output>
          </div>
        );
      })}
    </Panel>
  );
}

export function LiveImpact({ p }: { p: PersonaModel }) {
  const C = usePalette();
  const row = (label: string, value: string, color: string) => (
    <div className="row-sb">
      <span style={{ color: "var(--dim)" }}>{label}</span>
      <span className="m" style={{ color }}>
        {value}
      </span>
    </div>
  );
  return (
    <Panel>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Live impact
        <ChartType name="RADIAL GAUGE" />
      </div>
      <div role="group" aria-label="Live impact">
        <div style={{ maxWidth: 140, margin: "0 auto" }}>
          <PersonaRing
            pid={p.id}
            health={p.health}
            underPct={p.underPct}
            size={140}
            label={`${p.name} live impact ring`}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          {row("Devices below baseline", p.underCount.toLocaleString(), C.bad)}
        </div>
        {row("Share of persona", Math.round(p.underPct * 100) + "%", C.bad)}
        {row("Provisioning pillar", String(Math.round(p.pillars.prov)), bandColor(p.pillars.prov, C))}
        {row("Composite health", String(Math.round(p.health)), bandColor(p.health, C))}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14, lineHeight: 1.6 }}>
        Raising a minimum turns compliant devices non-compliant instantly. Use this to size a refresh
        programme before committing budget.
      </div>
    </Panel>
  );
}

export function FitCharts({ rows }: { rows: PersonaFit[] }) {
  const C = usePalette();
  const { tot, total } = fitTotals(rows);
  const donutRows = FIT_KINDS.map(({ key, tone }) => ({ key, n: tot[key], color: C[tone] })).filter(
    (d) => d.n,
  );
  return (
    <div className="g2">
      <Panel>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Overall fit status
          <ChartType name="DONUT" />
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 180, flexShrink: 0 }}>
            <Donut
              rows={donutRows}
              centerLabel="DEVICES"
              size={180}
              thickness={28}
              dimOpacity={0.92}
              delayStep={70}
              label="Overall fit status"
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }} role="list" aria-label="Fit status legend">
            {FIT_KINDS.map(({ key, label, tone }) => (
              <div
                key={key}
                role="listitem"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}
              >
                <i className="dot" style={{ background: C[tone] }} />
                <span style={{ fontSize: 11.5, color: "var(--dim)" }}>{label}</span>
                <span className="m" style={{ fontSize: 11.5, color: "var(--text)", marginLeft: "auto" }}>
                  {tot[key].toLocaleString()}
                </span>
                <span
                  className="m"
                  style={{ fontSize: 10.5, color: "var(--faint)", width: 48, textAlign: "right" }}
                >
                  {pctOf(tot[key], total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Fit distribution by persona
          <ChartType name="STACKED BAR" />
        </div>
        <FitStack rows={rows} />
      </Panel>
    </div>
  );
}

const cellTone = (v: number, C: Palette) => C[healthTone(v)];

function PersonaCell({ id, name, hue }: { id: PersonaId; name: string; hue: string }) {
  return (
    <td className="l">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Avatar pid={id} size={20} color={hue} />
        {name}
      </span>
    </td>
  );
}

interface TablesProps {
  rows: PersonaFit[];
  personas: PersonaModel[];
  defaults: Record<PersonaId, Baseline>;
  onPick: (id: PersonaId) => void;
}

export function ComponentTables({ rows, personas, defaults, onPick }: TablesProps) {
  const C = usePalette();
  const cell = (v: number) => (
    <td className="m" style={{ color: cellTone(v, C), background: cellTone(v, C) + "1A" }}>
      {v}%
    </td>
  );
  const heat = [...rows].sort((a, b) => a.cpuPct + a.ramPct + a.ssdPct - (b.cpuPct + b.ramPct + b.ssdPct));
  const ref = [...personas].sort((a, b) => a.baseline.cpuScore - b.baseline.cpuScore);
  const edited = (v: boolean) => ({ color: v ? C.accent : "var(--dim)" });
  const rowProps = (id: PersonaId, name: string) => ({
    tabIndex: 0,
    title: `Edit the ${name} contract`,
    onClick: () => onPick(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onPick(id);
    },
  });
  return (
    <div className="g2">
      <Panel>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          Component match
          <ChartType name="HEAT TABLE" />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 10 }}>
          Share of devices meeting the baseline on each part. Worst persona first — click a row to edit that
          contract.
        </div>
        <div className="tscroll">
          <table aria-label="Component match">
            <thead>
              <tr>
                <th className="l">Persona</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>SSD</th>
              </tr>
            </thead>
            <tbody>
              {heat.map((r) => (
                <tr key={r.id} {...rowProps(r.id, r.name)}>
                  <PersonaCell id={r.id} name={r.name} hue={r.hue} />
                  {cell(r.cpuPct)}
                  {cell(r.ramPct)}
                  {cell(r.ssdPct)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          Baseline reference
        </div>
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 10 }}>
          The contract every device is measured against. Blue means edited from default.
        </div>
        <div className="tscroll">
          <table aria-label="Baseline reference">
            <thead>
              <tr>
                <th className="l">Persona</th>
                <th className="l">CPU</th>
                <th>RAM</th>
                <th>SSD</th>
              </tr>
            </thead>
            <tbody>
              {ref.map((p) => {
                const b = p.baseline;
                const d = defaults[p.id];
                return (
                  <tr key={p.id} {...rowProps(p.id, p.name)}>
                    <PersonaCell id={p.id} name={p.name} hue={p.hue} />
                    <td className="l m" style={edited(b.cpuScore !== d.cpuScore)}>
                      {cpuTier(b.cpuScore)} <span style={{ color: "var(--faint)" }}>· idx {b.cpuScore}</span>
                    </td>
                    <td className="m" style={edited(b.ramGB !== d.ramGB)}>
                      {b.ramGB} GB
                    </td>
                    <td className="m" style={edited(b.storageGB !== d.storageGB)}>
                      {gb(b.storageGB)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function AppCatalogue({ name, apps }: { name: string; apps: string[] }) {
  return (
    <Panel>
      <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 12 }}>
        What {name} is entitled to install. Anything outside this list needs an exception, which shows up on
        the Change page.
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
        role="list"
        aria-label={`${name} app catalogue`}
      >
        {apps.map((a) => (
          <span
            key={a}
            role="listitem"
            style={{
              fontSize: 11.5,
              color: "var(--dim)",
              padding: "5px 9px",
              background: "var(--bg-deep)",
              border: "1px solid var(--line-soft)",
              borderRadius: 6,
            }}
          >
            {a}
          </span>
        ))}
        <span role="listitem">
          <button
            type="button"
            disabled
            title="Editing the catalogue arrives with the backend"
            style={{
              fontSize: 11.5,
              color: "var(--accent)",
              padding: "5px 9px",
              background: "none",
              border: "1px dashed var(--accent)",
              borderRadius: 6,
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: 0.7,
            }}
          >
            <Icon name="plus" size={11} /> Add app
          </button>
        </span>
      </div>
    </Panel>
  );
}
