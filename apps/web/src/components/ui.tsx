/* Layout primitives matching the wireframe's panel, statbox, chip, section and heading styles. */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { toneColor, type ToneOrAccent } from "../lib/format.ts";
import { AnimNum } from "./AnimNum.tsx";

export function Panel({
  children,
  style,
  pad,
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
}) {
  return (
    <div className="panel" style={{ ...(pad !== undefined ? { padding: pad } : {}), ...style }}>
      {children}
    </div>
  );
}

interface KpiProps {
  value: number;
  label: string;
  tone?: ToneOrAccent | null;
  dec?: number;
  pre?: string;
  suf?: string;
}

/** A headline number with a label, in a stat box. */
export function Kpi({ value, label, tone, dec, pre, suf }: KpiProps) {
  return (
    <div className="statbox" role="group" aria-label={label}>
      <div>
        <div className="stat-v" style={{ color: toneColor(tone) }}>
          <AnimNum value={value} dec={dec} pre={pre} suf={suf} />
        </div>
        <div className="eyebrow" style={{ marginTop: 6 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function Sect({ children }: { children: ReactNode }) {
  return <div className="sect">{children}</div>;
}

/** Chart-type label, visible when CHART NAMES is on. */
export function ChartType({ name }: { name: string }) {
  return <span className="ctype">{name}</span>;
}

export function Chip({ on, children, ...rest }: { on?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} {...rest}>
      {children}
    </button>
  );
}

interface PageHeadProps {
  step: string;
  title: string;
  sub: string;
  tools?: ReactNode;
}

export function PageHead({ step, title, sub, tools }: PageHeadProps) {
  return (
    <div className="pagehead">
      <div>
        <div className="step">{step}</div>
        <h2>{title}</h2>
        <div className="sub">{sub}</div>
      </div>
      <div className="pagetools">{tools}</div>
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-msg" role="status">
      {label}
    </div>
  );
}

export function ErrorMessage({ error }: { error: Error }) {
  return (
    <div className="state-msg error" role="alert">
      Could not load data: {error.message}
    </div>
  );
}

/** Placeholder for content that arrives in a later build step. */
export function ComingSoon({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="soon" style={{ marginTop: 18 }}>
      <b>Arrives in step {step}.</b> {children}
    </div>
  );
}
