/* UI state shared across pages: preferences (persisted), page filters and
   draft baselines. Server data lives in TanStack Query, not here. */
import type { Baseline, ConfidenceBand, PersonaId } from "@pfc/scoring";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TicketKind } from "../api/types.ts";
import { isThemeKey, type ThemeKey } from "../theme/themes.ts";

export type PersonaFilter = "all" | "risk";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface UiState {
  /* preferences */
  theme: ThemeKey;
  motion: boolean;
  chartNames: boolean;

  /* Personas page */
  personaFilter: PersonaFilter;
  mappingPersona: PersonaId | "all";
  mappingBand: ConfidenceBand | null;
  mappingQuery: string;

  /* Persona page: ticket-category filter and device search, for the persona in deviceFilterPersona */
  ticketCategory: string | null;
  deviceQuery: string;
  deviceFilterPersona: PersonaId | null;

  /* Tickets page */
  ticketKind: TicketKind;
  ticketPersona: PersonaId | "all";
  ticketCatFilter: string | null;

  /* Switch page wizard */
  switchUser: string;
  switchTo: PersonaId | "";

  /** Draft baselines per persona; a persona without an entry uses the API default. */
  draftBaselines: Record<PersonaId, Baseline>;

  setTheme: (theme: ThemeKey) => void;
  toggleMotion: () => void;
  toggleChartNames: () => void;
  set: (patch: Partial<Omit<UiState, `set${string}` | `toggle${string}` | "resetFilters">>) => void;
  setBaselineField: (pid: PersonaId, base: Baseline, field: keyof Baseline, value: number) => void;
  resetBaseline: (pid: PersonaId) => void;
  resetFilters: () => void;
}

const FILTER_DEFAULTS = {
  personaFilter: "all",
  mappingPersona: "all",
  mappingBand: null,
  mappingQuery: "",
  ticketCategory: null,
  deviceQuery: "",
  deviceFilterPersona: null,
  ticketKind: "inc",
  ticketPersona: "all",
  ticketCatFilter: null,
  switchUser: "",
  switchTo: "",
} satisfies Partial<UiState>;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "midnight",
      motion: !prefersReducedMotion(),
      chartNames: false,
      ...FILTER_DEFAULTS,
      draftBaselines: {},

      setTheme: (theme) => set({ theme }),
      toggleMotion: () => set((s) => ({ motion: !s.motion })),
      toggleChartNames: () => set((s) => ({ chartNames: !s.chartNames })),
      set: (patch) => set(patch),
      setBaselineField: (pid, base, field, value) =>
        set((s) => ({
          draftBaselines: {
            ...s.draftBaselines,
            [pid]: { ...(s.draftBaselines[pid] ?? base), [field]: value },
          },
        })),
      resetBaseline: (pid) =>
        set((s) => {
          const next = { ...s.draftBaselines };
          delete next[pid];
          return { draftBaselines: next };
        }),
      resetFilters: () => set(FILTER_DEFAULTS),
    }),
    {
      name: "pfc-ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      /* Only preferences survive a reload; filters and drafts reset like the wireframe. */
      partialize: (s) => ({ theme: s.theme, motion: s.motion, chartNames: s.chartNames }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiState>;
        return {
          ...current,
          theme: isThemeKey(p.theme) ? p.theme : current.theme,
          motion: typeof p.motion === "boolean" ? p.motion : current.motion,
          chartNames: typeof p.chartNames === "boolean" ? p.chartNames : current.chartNames,
        };
      },
    },
  ),
);
