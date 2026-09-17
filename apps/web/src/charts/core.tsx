/* Chart primitives. Geometry matches the wireframe's svgFluid, txt, arcA,
   rectA and numT helpers; animation comes from the chart's motion clock. */
import type { CSSProperties, ReactNode, SVGProps } from "react";
import { formatNum } from "../lib/format.ts";
import { MotionFrame } from "../motion/clock.tsx";
import { useElapsed } from "../motion/hooks.ts";
import { ease, progress } from "../motion/timing.ts";
import { arcPath, MONO } from "./geometry.ts";

interface SvgFluidProps {
  w: number;
  h: number;
  maxW?: number;
  label?: string;
  /** "img" for static charts; "group" when the chart contains buttons (img hides its children from assistive tech). */
  role?: "img" | "group";
  children: ReactNode;
}

/** Fixed internal coordinates, scaled to the container width. */
export function SvgFluid({ w, h, maxW, label, role = "img", children }: SvgFluidProps) {
  const style: CSSProperties = {
    width: "100%",
    height: "auto",
    display: "block",
    ...(maxW ? { maxWidth: maxW, margin: "0 auto" } : {}),
  };
  return (
    <MotionFrame>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={style}
        role={label ? role : undefined}
        aria-label={label}
      >
        {children}
      </svg>
    </MotionFrame>
  );
}

interface TxtProps {
  x: number;
  y: number;
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  children: ReactNode;
}

export function Txt({ x, y, size, fill, anchor = "start", children }: TxtProps) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} style={{ fontFamily: MONO }}>
      {children}
    </text>
  );
}

type PathRest = Omit<SVGProps<SVGPathElement>, "d" | "fill" | "opacity">;

interface AnimArcProps extends PathRest {
  inner: number;
  outer: number;
  corner: number;
  a0: number;
  a1: number;
  fill: string;
  opacity: number;
  delay?: number;
}

/** An arc that sweeps from its start angle to its end angle. */
export function AnimArc({ inner, outer, corner, a0, a1, fill, opacity, delay = 0, ...rest }: AnimArcProps) {
  const t = ease.out(progress(useElapsed(), delay, 850));
  const d = arcPath(inner, outer, corner, a0, a0 + (a1 - a0) * t);
  return <path d={d} fill={fill} opacity={opacity} {...rest} />;
}

interface AnimRectProps {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  fill: string;
  opacity: number;
  delay?: number;
  /** "up" grows from the baseline; "right" grows from the left edge. */
  dir?: "up" | "right";
}

export function AnimRect({ x, y, w, h, rx, fill, opacity, delay = 0, dir = "up" }: AnimRectProps) {
  const t = ease.out(progress(useElapsed(), delay, 700));
  const props =
    dir === "right" ? { x, y, width: w * t, height: h } : { x, y: y + h * (1 - t), width: w, height: h * t };
  return <rect {...props} rx={rx} fill={fill} opacity={opacity} />;
}

/** A stroke that draws itself along its length. */
export function DrawPath(props: SVGProps<SVGPathElement>) {
  const t = ease.inOut(progress(useElapsed(), 100, 1000));
  const draw = t < 1 ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - t } : {};
  return <path {...props} {...draw} />;
}

/** A shape that fades in. */
export function FadePath(props: SVGProps<SVGPathElement>) {
  const t = ease.inOut(progress(useElapsed(), 300, 600));
  return <path {...props} {...(t < 1 ? { opacity: t } : {})} />;
}

/** A dot that pops in with a slight overshoot. */
export function PopCircle({ r, delay, ...rest }: SVGProps<SVGCircleElement> & { r: number; delay: number }) {
  const t = ease.pop(progress(useElapsed(), delay, 430));
  return <circle r={r * t} {...rest} />;
}

interface AnimTextProps extends Omit<TxtProps, "children"> {
  value: number;
  dec?: number;
}

/** An SVG number that counts up. */
export function AnimText({ value, dec = 0, ...txt }: AnimTextProps) {
  const t = ease.out(progress(useElapsed(), 0, 900));
  return <Txt {...txt}>{formatNum(value * t, dec)}</Txt>;
}
