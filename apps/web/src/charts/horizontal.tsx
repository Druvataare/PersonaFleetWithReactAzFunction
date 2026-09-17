/* Horizontal bar charts: patch compliance by site and fit distribution by persona. */
import { FIT_KINDS, type Device, type PersonaFit } from "@pfc/scoring";
import { max } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import { usePalette } from "../theme/usePalette.ts";
import { AnimRect, SvgFluid, Txt } from "./core.tsx";
import { MONO } from "./geometry.ts";

/** Top six sites by device count; fill is the share patched. */
export function ComplianceBySite({
  devices,
  w = 340,
  h = 170,
}: {
  devices: Device[];
  w?: number;
  h?: number;
}) {
  const C = usePalette();
  const sites = Array.from(new Set(devices.map((d) => d.site)));
  const data = sites
    .map((s) => {
      const rows = devices.filter((d) => d.site === s);
      return { s, total: rows.length, ok: rows.filter((d) => d.patched).length };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const m = { t: 12, r: 34, b: 16, l: 74 };
  const y = scaleBand<string>()
    .domain(data.map((d) => d.s))
    .range([m.t, h - m.b])
    .padding(0.34);
  const x = scaleLinear()
    .domain([0, max(data, (d) => d.total) || 1])
    .range([m.l, w - m.r]);
  return (
    <SvgFluid w={w} h={h} label="Patch compliance by location">
      {data.map((d, i) => {
        const pct = Math.round((d.ok / d.total) * 100);
        const tone = pct >= 90 ? C.good : pct >= 75 ? C.warn : C.bad;
        const yy = y(d.s)!;
        return (
          <g key={d.s}>
            <Txt x={m.l - 7} y={yy + y.bandwidth() / 2 + 3} size={9.5} fill={C.dim} anchor="end">
              {d.s.length > 10 ? d.s.slice(0, 10) + "…" : d.s}
            </Txt>
            <rect x={m.l} y={yy} width={x(d.total) - m.l} height={y.bandwidth()} rx={3} fill={C.lineSoft} />
            <AnimRect
              x={m.l}
              y={yy}
              w={x(d.ok) - m.l}
              h={y.bandwidth()}
              rx={3}
              fill={tone}
              opacity={0.85}
              delay={i * 80}
              dir="right"
            />
            <Txt x={w - m.r + 4} y={yy + y.bandwidth() / 2 + 3} size={9} fill={tone}>
              {pct + "%"}
            </Txt>
          </g>
        );
      })}
    </SvgFluid>
  );
}

/** Headcount per persona split into fit, under, over and critical. */
export function FitStack({ rows, w = 560, h = 250 }: { rows: PersonaFit[]; w?: number; h?: number }) {
  const C = usePalette();
  const color = { good: C.good, warn: C.warn, accent: C.accent, bad: C.bad };
  const m = { t: 10, r: 14, b: 26, l: 120 };
  const data = [...rows].sort((a, b) => b.total - a.total);
  const y = scaleBand<string>()
    .domain(data.map((d) => d.id))
    .range([m.t, h - m.b])
    .padding(0.34);
  const x = scaleLinear()
    .domain([0, max(data, (d) => d.total) || 1])
    .range([m.l, w - m.r]);
  return (
    <>
      <SvgFluid w={w} h={h} label="Fit distribution by persona">
        {x.ticks(5).map((t) => (
          <g key={`g${t}`}>
            <line x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} stroke={C.lineSoft} strokeDasharray="2 3" />
            <Txt x={x(t)} y={h - m.b + 14} size={9} fill={C.faint} anchor="middle">
              {(t / 1000).toFixed(0) + "K"}
            </Txt>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          return (
            <g key={d.id}>
              <Txt x={m.l - 8} y={y(d.id)! + y.bandwidth() / 2 + 3} size={10} fill={C.dim} anchor="end">
                {d.name.length > 15 ? d.name.slice(0, 15) + "…" : d.name}
              </Txt>
              {FIT_KINDS.map(({ key, tone }, j) => {
                const v = d[key];
                if (!v) return null;
                const x0 = x(acc);
                const wd = x(acc + v) - x(acc);
                acc += v;
                return (
                  <AnimRect
                    key={key}
                    x={x0}
                    y={y(d.id)!}
                    w={Math.max(1, wd)}
                    h={y.bandwidth()}
                    rx={2}
                    fill={color[tone]}
                    opacity={0.88}
                    delay={i * 60 + j * 30}
                    dir="right"
                  />
                );
              })}
            </g>
          );
        })}
      </SvgFluid>
      {/* Legend as HTML (the wireframe drew it inside the SVG, where the last label was cut off). */}
      <div
        role="list"
        aria-label="Fit categories"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 16px",
          marginTop: 6,
          fontFamily: MONO,
          fontSize: 10.5,
          color: "var(--faint)",
        }}
      >
        {FIT_KINDS.map(({ key, label, tone }) => (
          <span key={key} role="listitem" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i className="dot" style={{ background: color[tone], width: 8, height: 8, borderRadius: 2 }} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
