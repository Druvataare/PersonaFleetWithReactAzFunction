/* Animation clock. Charts render from elapsed time since a view opened, so
   React owns every attribute and data can change mid-animation safely.

   - MOTION off, or the OS asks for reduced motion: elapsed is Infinity (final state).
   - <Replay on={...}> restarts every clock below it when `on` changes, the way
     the wireframe replays animations after each interaction. */
import { useState, type ReactNode } from "react";
import { ElapsedContext, ReplayContext, useMotionElapsed } from "./hooks.ts";

export function Replay({ on, children }: { on: unknown; children: ReactNode }) {
  const sig = JSON.stringify(on);
  const [state, setState] = useState({ sig, key: 0 });
  if (state.sig !== sig) setState({ sig, key: state.key + 1 });
  return <ReplayContext.Provider value={state.key}>{children}</ReplayContext.Provider>;
}

/** One clock per chart: every animated element inside reads the same elapsed time. */
export function MotionFrame({ children }: { children: ReactNode }) {
  const elapsed = useMotionElapsed();
  return <ElapsedContext.Provider value={elapsed}>{children}</ElapsedContext.Provider>;
}
