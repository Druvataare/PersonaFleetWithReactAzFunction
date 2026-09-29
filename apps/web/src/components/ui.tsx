/* Layout primitives matching the wireframe's panel, statbox, chip, section and heading styles. */
import { useEffect, useState } from "react";
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

/** A headline value that is text rather than a number (e.g. "High → Low"). */
export function TextKpi({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: ToneOrAccent | null;
}) {
  return (
    <div className="statbox" role="group" aria-label={label}>
      <div>
        <div className="stat-v" style={{ color: toneColor(tone) }}>
          {value}
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

/* A wait long enough to need explaining. The API runs on Flex Consumption,
   which scales to zero, so the first request after an idle period pays for a
   worker starting and for the first connection to an analytics engine --
   measured at 11.4s cold against 1.86s warm. An always-ready instance makes
   that rare, but scale-in can still happen, and a spinner that sits there for
   eleven seconds with nothing to say is indistinguishable from one that is
   broken. The note appears only when the wait is already abnormal, so an
   ordinary load never shows it. */
const SLOW_MS = 3000;

export function Loading({ label = "Loading…" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="state-msg" role="status">
      {label}
      {slow && (
        <div style={{ fontSize: 12, color: "var(--faint)", paddingTop: 8, maxWidth: "52ch" }}>
          The API is waking up. The first request after a quiet period takes a few seconds; later
          ones are quick.
        </div>
      )}
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
