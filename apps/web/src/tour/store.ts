/* Guided tour state. Navigation and side effects live in TourController. */
import { create } from "zustand";
import { TOUR } from "./steps.ts";

export interface TourState {
  active: boolean;
  step: number;
  paused: boolean;
  captions: boolean;
  start: () => void;
  stop: () => void;
  /** Moves to a step; past the last step ends the tour. */
  go: (step: number) => void;
  togglePause: () => void;
  toggleCaptions: () => void;
}

export const useTour = create<TourState>()((set) => ({
  active: false,
  step: 0,
  paused: false,
  captions: true,
  start: () => set({ active: true, step: 0, paused: false }),
  stop: () => set({ active: false, step: 0, paused: false }),
  go: (step) =>
    set(() =>
      step >= TOUR.length ? { active: false, step: 0, paused: false } : { step: Math.max(0, step) },
    ),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  toggleCaptions: () => set((s) => ({ captions: !s.captions })),
}));
