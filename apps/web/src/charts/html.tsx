/* HTML-based charts: bullet chart (actual vs target) and ranked bar list. */
import { scaleLinear } from "d3";
import { Icon, type IconName } from "../components/Icon.tsx";
import type { KeyCount } from "../api/types.ts";
import { MotionFrame } from "../motion/clock.tsx";
import { useElapsed } from "../motion/hooks.ts";
import { ease, progress } from "../motion/timing.ts";
import { usePalette } from "../theme/usePalette.ts";
import { AnimRect } from "./core.tsx";

interface BulletProps {
  label: string;
  actual: number;
  target: number;
  max: number;
  unit: string;
  /** Lower is better (boot time, crashes). */
  invert?: boolean;
  icon: IconName;
}

export function Bullet({ label, actual, target, max, unit, invert = false, icon }: BulletProps) {
  const C = usePalette();
  const w = 190;
  const x = scaleLinear().domain([0, max]).range([0, w]);
  const ok = invert ? actual <= target : actual >= target;
  const tone = ok ? C.good : C.bad;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}
      role="group"
      aria-label={label}
    >
      <div
        style={{
          width: 112,
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: "var(--dim)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
        {label}
      </div>
      <MotionFrame>
        <svg
          viewBox={`0 0 ${w} 26`}
          preserveAspectRatio="none"
          style={{ flex: 1, height: 26, minWidth: 60 }}
          aria-hidden="true"
        >
          <rect y={8} width={w} height={10} rx={5} fill={C.lineSoft} />
          <AnimRect
            x={0}
            y={8}
            w={Math.max(3, x(Math.min(actual, max)))}
            h={10}
            rx={5}
            fill={tone}
            opacity={0.9}
            delay={120}
            dir="right"
          />
          <line
            x1={x(Math.min(target, max))}
            x2={x(Math.min(target, max))}
            y1={4}
            y2={22}
            stroke={C.accent}
            strokeWidth={2}
          />
        </svg>
      </MotionFrame>
      <div className="m" style={{ fontSize: 12, color: tone, width: 88, textAlign: "right", flexShrink: 0 }}>
        {actual}
        {unit}{" "}
        <span style={{ color: "var(--faint)" }}>
          / {target}
          {unit}
        </span>
      </div>
    </div>
  );
}

function BarFill({ pct, color, index }: { pct: number; color: string; index: number }) {
  const t = ease.out(progress(useElapsed(), Math.min(index * 30, 400), 700));
  return (
    <div
      className="bar-fill"
      data-w={pct}
      style={{ width: `${pct * t}%`, background: color, transition: "none" }}
    />
  );
}

/** Ranked horizontal bars with labels and counts. */
export function BarList({ rows, color }: { rows: KeyCount[]; color: string }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <MotionFrame>
      <div role="list">
        {rows.map((r, i) => (
          <div
            key={r.k}
            role="listitem"
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}
          >
            <div
              className="truncate"
              style={{ width: 110, fontSize: 11.5, color: "var(--dim)", flexShrink: 0 }}
              title={r.k}
            >
              {r.k}
            </div>
            <div className="bar-track">
              <BarFill pct={(r.n / top) * 100} color={color} index={i} />
            </div>
            <div
              className="m"
              style={{ fontSize: 11, color: "var(--faint)", width: 24, textAlign: "right", flexShrink: 0 }}
            >
              {r.n}
            </div>
          </div>
        ))}
      </div>
    </MotionFrame>
  );
}
