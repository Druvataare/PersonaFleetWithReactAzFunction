import { createContext, useContext, useLayoutEffect, useState } from "react";
import { useUi } from "../store/ui.ts";
import { MOTION_WINDOW_MS } from "./timing.ts";

export const ReplayContext = createContext(0);
export const ElapsedContext = createContext(Infinity);

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Milliseconds since the animation started, or Infinity when finished or disabled. */
export function useMotionElapsed(): number {
  const motion = useUi((s) => s.motion);
  const replay = useContext(ReplayContext);
  const enabled = motion && !prefersReducedMotion();
  const [frame, setFrame] = useState({ key: -1, elapsed: 0 });

  useLayoutEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = now - start;
      const done = elapsed >= MOTION_WINDOW_MS;
      setFrame({ key: replay, elapsed: done ? Infinity : elapsed });
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, replay]);

  if (!enabled) return Infinity;
  return frame.key === replay ? frame.elapsed : 0;
}

/** Elapsed time of the enclosing chart's clock. */
export const useElapsed = () => useContext(ElapsedContext);
