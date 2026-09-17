import { easeBackOut, easeCubicInOut, easeCubicOut } from "d3";

/** Longest animation (staggered dots) finishes well inside this window. */
export const MOTION_WINDOW_MS = 2600;

/** Linear 0–1 progress of one element's animation. */
export const progress = (elapsed: number, delay: number, duration: number): number =>
  elapsed === Infinity ? 1 : Math.max(0, Math.min(1, (elapsed - delay) / duration));

export const ease = {
  out: easeCubicOut,
  inOut: easeCubicInOut,
  pop: easeBackOut.overshoot(1.6),
};
