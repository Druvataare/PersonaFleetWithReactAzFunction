/* Radial gauges: persona ring (landing grid, identity band, live impact) and pillar gauge. */
import type { Pillars, PersonaId } from "@pfc/scoring";
import { Avatar } from "../components/Avatar.tsx";
import { bandColor, usePalette } from "../theme/usePalette.ts";
import { AnimArc, AnimText, SvgFluid, Txt } from "./core.tsx";
import { arcPath } from "./geometry.ts";

interface PersonaRingProps {
  pid: PersonaId;
  /** Persona health, 0–100. */
  health: number;
  /** Share of devices below baseline, 0–1. */
  underPct: number;
  size?: number;
  label?: string;
}

/** Outer arc: persona health. Inner red arc: share below baseline. */
export function PersonaRing({ pid, health, underPct, size = 150, label }: PersonaRingProps) {
  const C = usePalette();
  const r = size / 2 - 12;
  const col = bandColor(health, C);
  return (
    <SvgFluid w={size} h={size} maxW={size} label={label}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle className="ring-plate" r={r - 20} fill={C.plate} />
        <path d={arcPath(r - 9, r, 5, 0, 2 * Math.PI)} fill={C.lineSoft} />
        <AnimArc
          inner={r - 9}
          outer={r}
          corner={5}
          a0={0}
          a1={2 * Math.PI * (health / 100)}
          fill={col}
          opacity={0.92}
          delay={60}
        />
        <AnimArc
          inner={r - 17}
          outer={r - 12}
          corner={5}
          a0={0}
          a1={2 * Math.PI * underPct}
          fill={C.bad}
          opacity={0.55}
          delay={320}
        />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={-(r + 4)}
            x2={0}
            y2={-(r + 7)}
            stroke={C.line}
            strokeWidth={1}
            transform={`rotate(${i * 15})`}
          />
        ))}
        <g transform="translate(-20,-24)">
          <Avatar pid={pid} size={40} color={C.dim} className="ring-avatar" />
        </g>
        <AnimText x={0} y={28} value={Math.round(health)} size={17} fill={col} anchor="middle" />
      </g>
    </SvgFluid>
  );
}

const PILLARS: ReadonlyArray<[keyof Pillars, string]> = [
  ["prov", "PROV"],
  ["perf", "PERF"],
  ["comp", "COMP"],
  ["exp", "EXPR"],
  ["sup", "SUPP"],
];

/** Five concentric 270° arcs, one per health pillar. */
export function PillarGauge({ pillars, size = 200 }: { pillars: Pillars; size?: number }) {
  const C = usePalette();
  const r = size / 2 - 6;
  const a0 = -Math.PI * 0.75;
  const a1 = Math.PI * 0.75;
  return (
    <SvgFluid w={size} h={size} maxW={size} label="Health pillars" overflowVisible>
      <g transform={`translate(${size / 2},${size / 2})`}>
        {PILLARS.map(([k, l], i) => {
          const v = pillars[k];
          const inner = r - 16 - i * 16;
          const outer = r - 3 - i * 16;
          return (
            <g key={k}>
              <path d={arcPath(inner, outer, 3, a0, a1)} fill={C.lineSoft} />
              <AnimArc
                inner={inner}
                outer={outer}
                corner={3}
                a0={a0}
                a1={a0 + (a1 - a0) * (v / 100)}
                fill={bandColor(v, C)}
                opacity={0.9}
                delay={80 + i * 110}
              />
              <Txt x={-(outer + 2)} y={outer * 0.72} size={8.5} fill={C.faint} anchor="end">
                {l}
              </Txt>
            </g>
          );
        })}
        <Txt x={0} y={36} size={9} fill={C.faint} anchor="middle">
          WEIGHTED
        </Txt>
      </g>
    </SvgFluid>
  );
}
