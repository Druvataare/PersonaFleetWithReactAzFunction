/* Donut with a total in the middle. Slices can act as filters. */
import { pie, sum } from "d3";
import type { KeyboardEvent } from "react";
import { usePalette } from "../theme/usePalette.ts";
import { AnimArc, AnimText, SvgFluid, Txt } from "./core.tsx";

export interface DonutRow {
  key: string;
  n: number;
  color: string;
}

interface DonutProps {
  rows: DonutRow[];
  centerLabel: string;
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  padAngle?: number;
  /** Highlighted key; other slices are dimmed. */
  active?: string | null;
  dimOpacity?: number;
  delayStep?: number;
  centerSize?: number;
  /** Makes slices buttons. */
  onSelect?: (key: string) => void;
  label?: string;
}

export function Donut({
  rows,
  centerLabel,
  size = 190,
  thickness = 26,
  padAngle = 0.015,
  active = null,
  dimOpacity = 0.22,
  delayStep = 60,
  centerSize = 20,
  onSelect,
  label,
}: DonutProps) {
  const C = usePalette();
  const r = size / 2 - 6;
  const slices = pie<DonutRow>()
    .value((d) => d.n)
    .sort(null)
    .padAngle(padAngle)(rows);
  const total = sum(rows, (d) => d.n);
  return (
    <SvgFluid w={size} h={size} maxW={size} label={label ?? centerLabel.toLowerCase()}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        {slices.map((a, i) => {
          const interactive = onSelect
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": `${a.data.key}: ${a.data.n.toLocaleString()}`,
                "aria-pressed": active === a.data.key,
                style: { cursor: "pointer" },
                onClick: () => onSelect(a.data.key),
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(a.data.key);
                  }
                },
              }
            : {};
          return (
            <AnimArc
              key={a.data.key}
              inner={r - thickness}
              outer={r}
              corner={4}
              a0={a.startAngle}
              a1={a.endAngle}
              fill={a.data.color}
              opacity={!active || active === a.data.key ? 0.92 : dimOpacity}
              delay={i * delayStep}
              className="slice"
              {...interactive}
            />
          );
        })}
        <AnimText x={0} y={-2} value={total} size={centerSize} fill={C.text} anchor="middle" />
        <Txt x={0} y={15} size={8.5} fill={C.faint} anchor="middle">
          {centerLabel}
        </Txt>
      </g>
    </SvgFluid>
  );
}
