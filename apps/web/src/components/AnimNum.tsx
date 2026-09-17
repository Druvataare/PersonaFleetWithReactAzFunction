/* A number that counts up from zero when its view opens (if MOTION is on). */
import { formatNum } from "../lib/format.ts";
import { useMotionElapsed } from "../motion/hooks.ts";
import { ease, progress } from "../motion/timing.ts";

interface AnimNumProps {
  value: number;
  /** Decimal places; 0 formats with thousands separators. */
  dec?: number;
  pre?: string;
  suf?: string;
}

export function AnimNum({ value, dec = 0, pre = "", suf = "" }: AnimNumProps) {
  const t = ease.out(progress(useMotionElapsed(), 0, 900));
  const shown = Number.isFinite(value) ? value * t : value;
  return (
    <span className="anim-num" data-value={value}>
      {pre + formatNum(shown, dec) + suf}
    </span>
  );
}
