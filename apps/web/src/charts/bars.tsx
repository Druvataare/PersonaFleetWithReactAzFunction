/* Column charts: baseline histogram, binned histogram, weekly volume, age × priority. */
import { bin, max, range, type Bin } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import type { AgeBucket } from "../api/types.ts";
import { usePalette } from "../theme/usePalette.ts";
import { AnimRect, SvgFluid, Txt } from "./core.tsx";

interface BaselineHistogramProps {
  /** One value per device, e.g. RAM in GB. */
  values: number[];
  baseValue: number;
  label: string;
  unit: string;
  w?: number;
  h?: number;
}

/** Devices per discrete size, green at or above the baseline, with the baseline marked. */
export function BaselineHistogram({
  values,
  baseValue,
  label,
  unit,
  w = 340,
  h = 150,
}: BaselineHistogramProps) {
  const C = usePalette();
  const cats = Array.from(new Set(values)).sort((a, b) => a - b);
  const counts = cats.map((c) => ({ c, n: values.filter((v) => v === c).length }));
  const m = { t: 16, r: 10, b: 28, l: 30 };
  const x = scaleBand<number>()
    .domain(cats)
    .range([m.l, w - m.r])
    .padding(0.3);
  const y = scaleLinear()
    .domain([0, max(counts, (d) => d.n) || 1])
    .nice()
    .range([h - m.b, m.t]);
  const bcat = cats.find((c) => c >= baseValue);
  const bx = bcat !== undefined ? x(bcat)! - 5 : undefined;
  return (
    <SvgFluid w={w} h={h} label={label}>
      {y.ticks(3).map((t) => (
        <g key={`g${t}`}>
          <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={C.lineSoft} />
          <Txt x={m.l - 6} y={y(t) + 3} size={9} fill={C.faint} anchor="end">
            {t}
          </Txt>
        </g>
      ))}
      {counts.map((d, i) => {
        const ok = d.c >= baseValue;
        return (
          <g key={d.c}>
            <AnimRect
              x={x(d.c)!}
              y={y(d.n)}
              w={x.bandwidth()}
              h={h - m.b - y(d.n)}
              rx={3}
              fill={ok ? C.good : C.bad}
              opacity={ok ? 0.8 : 0.65}
              delay={i * 70}
            />
            <Txt
              x={x(d.c)! + x.bandwidth() / 2}
              y={h - m.b + 13}
              size={9}
              fill={ok ? C.dim : C.bad}
              anchor="middle"
            >
              {d.c >= 1024 ? d.c / 1024 + "T" : d.c}
            </Txt>
          </g>
        );
      })}
      {bx !== undefined && (
        <>
          <line
            x1={bx}
            x2={bx}
            y1={m.t - 8}
            y2={h - m.b}
            stroke={C.accent}
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
          <Txt x={bx + 3} y={m.t - 2} size={9} fill={C.accent}>
            {"baseline " + (baseValue >= 1024 ? baseValue / 1024 + "TB" : baseValue + unit)}
          </Txt>
        </>
      )}
      <Txt x={m.l} y={h - 2} size={9} fill={C.faint}>
        {label}
      </Txt>
    </SvgFluid>
  );
}

interface BinHistogramProps {
  values: number[];
  thresholds: number[];
  binLabel: (b: Bin<number, number>) => string | number;
  binColor: (b: Bin<number, number>) => string;
  label: string;
  w?: number;
  h?: number;
}

/** Values grouped into ranges, each bar coloured by its range. */
export function BinHistogram({
  values,
  thresholds,
  binLabel,
  binColor,
  label,
  w = 340,
  h = 150,
}: BinHistogramProps) {
  const C = usePalette();
  const bins = bin().thresholds(thresholds)(values);
  const m = { t: 14, r: 10, b: 28, l: 30 };
  const x = scaleBand<number>()
    .domain(bins.map((_, i) => i))
    .range([m.l, w - m.r])
    .padding(0.22);
  const y = scaleLinear()
    .domain([0, max(bins, (b) => b.length) || 1])
    .nice()
    .range([h - m.b, m.t]);
  return (
    <SvgFluid w={w} h={h} label={label}>
      {y.ticks(3).map((t) => (
        <g key={`g${t}`}>
          <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={C.lineSoft} />
          <Txt x={m.l - 6} y={y(t) + 3} size={9} fill={C.faint} anchor="end">
            {t}
          </Txt>
        </g>
      ))}
      {bins.map((b, i) => (
        <g key={i}>
          <AnimRect
            x={x(i)!}
            y={y(b.length)}
            w={x.bandwidth()}
            h={h - m.b - y(b.length)}
            rx={3}
            fill={binColor(b)}
            opacity={0.85}
            delay={i * 70}
          />
          <Txt x={x(i)! + x.bandwidth() / 2} y={h - m.b + 13} size={9} fill={C.faint} anchor="middle">
            {binLabel(b)}
          </Txt>
        </g>
      ))}
      <Txt x={m.l} y={h - 2} size={9} fill={C.faint}>
        {label}
      </Txt>
    </SvgFluid>
  );
}

/** Weekly ticket volume, oldest week on the left. */
export function WeekBars({
  series,
  color,
  w = 560,
  h = 150,
}: {
  series: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  const C = usePalette();
  const m = { t: 14, r: 10, b: 28, l: 32 };
  const x = scaleBand<number>()
    .domain(range(series.length))
    .range([m.l, w - m.r])
    .padding(0.26);
  const y = scaleLinear()
    .domain([0, max(series) || 1])
    .nice()
    .range([h - m.b, m.t]);
  return (
    <SvgFluid w={w} h={h} label="Volume by week">
      {y.ticks(3).map((t) => (
        <g key={`g${t}`}>
          <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={C.lineSoft} />
          <Txt x={m.l - 6} y={y(t) + 3} size={9} fill={C.faint} anchor="end">
            {t}
          </Txt>
        </g>
      ))}
      {series.map((v, i) => (
        <g key={i}>
          <AnimRect
            x={x(i)!}
            y={y(v)}
            w={x.bandwidth()}
            h={h - m.b - y(v)}
            rx={3}
            fill={color}
            opacity={0.85}
            delay={i * 45}
          />
          {i % 2 === 0 && (
            <Txt x={x(i)! + x.bandwidth() / 2} y={h - m.b + 13} size={9} fill={C.faint} anchor="middle">
              {series.length - i + "w"}
            </Txt>
          )}
        </g>
      ))}
      <Txt x={m.l} y={h - 2} size={8.5} fill={C.faint}>
        WEEKS AGO → NOW
      </Txt>
    </SvgFluid>
  );
}

const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;

/** Tickets by age bucket, stacked by priority. */
export function StackedAge({ buckets, w = 340, h = 170 }: { buckets: AgeBucket[]; w?: number; h?: number }) {
  const C = usePalette();
  const colors = [C.bad, C.warn, C.accent, C.cyan];
  const m = { t: 14, r: 10, b: 30, l: 30 };
  const x = scaleBand<string>()
    .domain(buckets.map((d) => d.label))
    .range([m.l, w - m.r])
    .padding(0.32);
  const y = scaleLinear()
    .domain([0, max(buckets, (d) => d.total) || 1])
    .nice()
    .range([h - m.b, m.t]);
  return (
    <SvgFluid w={w} h={h} label="Tickets by age and priority">
      {y.ticks(3).map((t) => (
        <g key={`g${t}`}>
          <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={C.lineSoft} />
          <Txt x={m.l - 6} y={y(t) + 3} size={9} fill={C.faint} anchor="end">
            {t}
          </Txt>
        </g>
      ))}
      {buckets.map((d, bi) => {
        let acc = 0;
        return (
          <g key={d.label}>
            {d.vals.map((v, i) => {
              const yy = y(acc + v);
              const hh = y(acc) - y(acc + v);
              acc += v;
              return v ? (
                <AnimRect
                  key={i}
                  x={x(d.label)!}
                  y={yy}
                  w={x.bandwidth()}
                  h={hh}
                  rx={0}
                  fill={colors[i]}
                  opacity={0.85}
                  delay={bi * 90 + i * 40}
                />
              ) : null;
            })}
            <Txt x={x(d.label)! + x.bandwidth() / 2} y={h - m.b + 13} size={9} fill={C.faint} anchor="middle">
              {d.label + "d"}
            </Txt>
          </g>
        );
      })}
      {PRIORITIES.map((p, i) => (
        <g key={p}>
          <rect x={m.l + i * 44} y={h - 13} width={8} height={8} rx={2} fill={colors[i]} />
          <Txt x={m.l + i * 44 + 12} y={h - 6} size={9} fill={C.faint}>
            {p}
          </Txt>
        </g>
      ))}
    </SvgFluid>
  );
}
