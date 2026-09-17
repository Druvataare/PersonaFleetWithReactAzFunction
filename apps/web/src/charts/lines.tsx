/* Line-based charts: health trend, boot vs free-disk scatter, migration flow. */
import { max, min } from "d3-array";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { useId } from "react";
import type { Baseline, Device, Migration, PersonaDef } from "@pfc/scoring";
import { Avatar } from "../components/Avatar.tsx";
import { usePalette } from "../theme/usePalette.ts";
import { DrawPath, FadePath, PopCircle, SvgFluid, Txt } from "./core.tsx";

/** 12-week area chart with the latest point emphasised. */
export function TrendArea({
  series,
  color,
  w = 340,
  h = 120,
}: {
  series: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  const C = usePalette();
  const gid = "tg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const m = { t: 10, r: 8, b: 18, l: 26 };
  const x = scaleLinear()
    .domain([0, series.length - 1])
    .range([m.l, w - m.r]);
  const y = scaleLinear()
    .domain([(min(series) ?? 0) - 6, 100])
    .range([h - m.b, m.t]);
  const lineGen = line<number>()
    .x((_, i) => x(i))
    .y((d) => y(d))
    .curve(curveMonotoneX);
  const areaGen = area<number>()
    .x((_, i) => x(i))
    .y0(h - m.b)
    .y1((d) => y(d))
    .curve(curveMonotoneX);
  const last = series[series.length - 1];
  return (
    <SvgFluid w={w} h={h} label="Health trend, 12 weeks">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <FadePath d={areaGen(series) ?? ""} fill={`url(#${gid})`} />
      <DrawPath d={lineGen(series) ?? ""} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <PopCircle cx={x(series.length - 1)} cy={y(last)} r={3.5} fill={color} delay={220} />
      {["12w", "8w", "4w", "now"].map((t, i) => (
        <Txt key={t} x={x((i * (series.length - 1)) / 3)} y={h - 4} size={9} fill={C.faint} anchor="middle">
          {t}
        </Txt>
      ))}
    </SvgFluid>
  );
}

/** Each device: boot time across, free disk up, dot size by crashes. Shaded zones breach the baseline. */
export function BootScatter({
  devices,
  baseline: b,
  w = 340,
  h = 190,
}: {
  devices: Device[];
  baseline: Baseline;
  w?: number;
  h?: number;
}) {
  const C = usePalette();
  const m = { t: 14, r: 12, b: 30, l: 36 };
  const x = scaleLinear()
    .domain([0, (max(devices, (d) => d.bootSec) ?? 0) * 1.05])
    .range([m.l, w - m.r]);
  const y = scaleLinear()
    .domain([0, 70])
    .range([h - m.b, m.t]);
  const r = scaleSqrt()
    .domain([0, max(devices, (d) => d.crashes) || 1])
    .range([2.5, 7]);
  return (
    <SvgFluid w={w} h={h} label="Boot time against free disk">
      <rect
        x={x(b.bootSec)}
        y={m.t}
        width={Math.max(0, w - m.r - x(b.bootSec))}
        height={h - m.b - m.t}
        fill={C.bad}
        opacity={0.055}
      />
      <rect
        x={m.l}
        y={y(b.freePct)}
        width={w - m.r - m.l}
        height={Math.max(0, h - m.b - y(b.freePct))}
        fill={C.bad}
        opacity={0.055}
      />
      {y.ticks(4).map((t) => (
        <g key={`y${t}`}>
          <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={C.lineSoft} />
          <Txt x={m.l - 6} y={y(t) + 3} size={9} fill={C.faint} anchor="end">
            {t + "%"}
          </Txt>
        </g>
      ))}
      {x.ticks(4).map((t) => (
        <Txt key={`x${t}`} x={x(t)} y={h - m.b + 13} size={9} fill={C.faint} anchor="middle">
          {t + "s"}
        </Txt>
      ))}
      <line
        x1={x(b.bootSec)}
        x2={x(b.bootSec)}
        y1={m.t}
        y2={h - m.b}
        stroke={C.accent}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <line
        x1={m.l}
        x2={w - m.r}
        y1={y(b.freePct)}
        y2={y(b.freePct)}
        stroke={C.accent}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      {devices.map((d, i) => {
        const breach = d.bootSec > b.bootSec || d.freePct < b.freePct;
        return (
          <PopCircle
            key={d.id}
            cx={x(d.bootSec)}
            cy={y(Math.min(d.freePct, 70))}
            r={r(d.crashes)}
            fill={breach ? C.bad : C.good}
            opacity={0.68}
            delay={220 + i * 11}
          />
        );
      })}
      <Txt x={m.l} y={h - 2} size={8.5} fill={C.faint}>
        BOOT TIME → · FREE DISK ↑ · SIZE = CRASHES
      </Txt>
    </SvgFluid>
  );
}

interface MigrationFlowProps {
  migrations: Migration[];
  personas: Pick<PersonaDef, "id" | "name" | "hue">[];
  w?: number;
  h?: number;
}

/** Sankey-style flow: personas people left on the left, personas they joined on the right. */
export function MigrationFlow({ migrations: rows, personas, w = 600, h = 290 }: MigrationFlowProps) {
  const C = usePalette();
  const def = (id: string) => personas.find((p) => p.id === id) ?? { id, name: id, hue: C.accent };
  const L1 = Array.from(new Set(rows.map((r) => r.from)));
  const R1 = Array.from(new Set(rows.map((r) => r.to)));
  const pos = (ids: string[]) => {
    const g = (h - 40) / ids.length;
    return Object.fromEntries(ids.map((id, i) => [id, 30 + g * i + g / 2 - 20])) as Record<string, number>;
  };
  const L = pos(L1);
  const R = pos(R1);
  const out = Object.fromEntries(
    L1.map((id) => [id, rows.filter((r) => r.from === id).reduce((a, r) => a + r.people, 0)]),
  );
  const inn = Object.fromEntries(
    R1.map((id) => [id, rows.filter((r) => r.to === id).reduce((a, r) => a + r.people, 0)]),
  );
  const wS = scaleLinear()
    .domain([0, max(rows, (r) => r.people) ?? 0])
    .range([2, 18]);
  const x0 = 126;
  const x1 = w - 126;

  const nodes = (ids: string[], map: Record<string, number>, x: number, side: "l" | "r") =>
    ids.map((id) => {
      const p = def(id);
      return (
        <g key={`${side}${id}`} transform={`translate(${x},${map[id]})`}>
          <rect width={120} height={40} rx={8} fill={C.panel2} stroke={C.line} />
          <g transform="translate(7,6)">
            <Avatar pid={id} size={28} color={p.hue} />
          </g>
          {/* Long names are fitted to the node (the wireframe let them spill past the box and get cut off). */}
          <text
            x={41}
            y={18}
            fontSize={10.5}
            fill={C.text}
            style={{ fontFamily: "var(--sans)" }}
            {...(p.name.length > 12 ? { textLength: 74, lengthAdjust: "spacingAndGlyphs" } : {})}
          >
            {p.name}
          </text>
          <Txt x={41} y={31} size={9.5} fill={side === "r" ? C.good : C.faint}>
            {(side === "r" ? "+" + inn[id] : "−" + out[id]) + " people"}
          </Txt>
        </g>
      );
    });

  return (
    <SvgFluid w={w} h={h} label="Where people moved">
      {rows.map((r) => {
        const y0 = L[r.from] + 20;
        const y1 = R[r.to] + 20;
        return (
          <DrawPath
            key={`${r.from}-${r.to}`}
            d={`M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`}
            fill="none"
            stroke={def(r.to).hue}
            strokeWidth={wS(r.people)}
            opacity={0.5}
          />
        );
      })}
      {nodes(L1, L, 4, "l")}
      {nodes(R1, R, w - 124, "r")}
    </SvgFluid>
  );
}
