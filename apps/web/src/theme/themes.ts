/* The wireframe's seven themes. Colours are applied as CSS variables for
   styles, and read from JavaScript (usePalette) for SVG charts. */

export interface Palette {
  label: string;
  bg: string;
  bgDeep: string;
  panel: string;
  panel2: string;
  line: string;
  lineSoft: string;
  hover: string;
  plate: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  good: string;
  warn: string;
  bad: string;
  fresh: string;
  cyan: string;
}

export const THEMES = {
  midnight: {
    label: "Midnight Indigo",
    bg: "#0B0F1C",
    bgDeep: "#070A14",
    panel: "#121729",
    panel2: "#161C31",
    line: "#232B45",
    lineSoft: "#1B2138",
    hover: "rgba(255,255,255,.045)",
    plate: "rgba(255,255,255,.02)",
    text: "#E9ECF6",
    dim: "#8B94B2",
    faint: "#5A6383",
    accent: "#7C8CFF",
    good: "#35D6A5",
    warn: "#F5B546",
    bad: "#FF6B7A",
    fresh: "#B47CFF",
    cyan: "#4CC9E8",
  },
  carbon: {
    label: "Carbon",
    bg: "#0D0D0F",
    bgDeep: "#08080A",
    panel: "#151517",
    panel2: "#1B1B1E",
    line: "#2A2A2E",
    lineSoft: "#202024",
    hover: "rgba(255,255,255,.05)",
    plate: "rgba(255,255,255,.02)",
    text: "#EDEDEF",
    dim: "#96969E",
    faint: "#63636B",
    accent: "#8AA2FF",
    good: "#4ADE9B",
    warn: "#F0B429",
    bad: "#F4707F",
    fresh: "#C08CFF",
    cyan: "#5CD0E8",
  },
  nord: {
    label: "Nord Frost",
    bg: "#111823",
    bgDeep: "#0C121B",
    panel: "#18202D",
    panel2: "#1E2734",
    line: "#2B3648",
    lineSoft: "#222B3A",
    hover: "rgba(216,222,233,.05)",
    plate: "rgba(216,222,233,.02)",
    text: "#E5E9F0",
    dim: "#93A0B4",
    faint: "#68758A",
    accent: "#88C0D0",
    good: "#A3BE8C",
    warn: "#EBCB8B",
    bad: "#BF616A",
    fresh: "#B48EAD",
    cyan: "#8FBCBB",
  },
  ember: {
    label: "Ember",
    bg: "#14100D",
    bgDeep: "#0E0B09",
    panel: "#1D1713",
    panel2: "#241D18",
    line: "#352A22",
    lineSoft: "#28201A",
    hover: "rgba(255,236,214,.05)",
    plate: "rgba(255,236,214,.02)",
    text: "#F2E9E0",
    dim: "#A9998A",
    faint: "#786A5E",
    accent: "#E0A458",
    good: "#7FBF7A",
    warn: "#E8B44C",
    bad: "#E06C55",
    fresh: "#C58CD8",
    cyan: "#63BFC4",
  },
  teal: {
    label: "Deep Teal",
    bg: "#07161A",
    bgDeep: "#041014",
    panel: "#0D2026",
    panel2: "#12292F",
    line: "#1D3A42",
    lineSoft: "#163038",
    hover: "rgba(214,247,247,.05)",
    plate: "rgba(214,247,247,.02)",
    text: "#E3F2F2",
    dim: "#8AA9AC",
    faint: "#5C7C80",
    accent: "#5AD1C8",
    good: "#5CD69A",
    warn: "#EFC05A",
    bad: "#F0757F",
    fresh: "#A78BFA",
    cyan: "#4CC9E8",
  },
  daylight: {
    label: "Daylight",
    bg: "#F5F6FA",
    bgDeep: "#FFFFFF",
    panel: "#FFFFFF",
    panel2: "#EEF0F6",
    line: "#DDE1EC",
    lineSoft: "#E8EBF3",
    hover: "rgba(20,28,56,.045)",
    plate: "rgba(20,28,56,.025)",
    text: "#161C2E",
    dim: "#5C6580",
    faint: "#8A93AC",
    accent: "#4457E0",
    good: "#0F9D6B",
    warn: "#B87500",
    bad: "#D63652",
    fresh: "#7A3FD0",
    cyan: "#0E86A8",
  },
  parchment: {
    label: "Parchment",
    bg: "#F6F2EA",
    bgDeep: "#FFFDF8",
    panel: "#FFFDF8",
    panel2: "#EFE9DE",
    line: "#DFD6C6",
    lineSoft: "#E9E2D5",
    hover: "rgba(60,45,25,.05)",
    plate: "rgba(60,45,25,.025)",
    text: "#241D14",
    dim: "#6B5D4B",
    faint: "#988975",
    accent: "#7A4E1F",
    good: "#2F7D4F",
    warn: "#A8700B",
    bad: "#B33A2B",
    fresh: "#7A4192",
    cyan: "#12707F",
  },
} satisfies Record<string, Palette>;

export type ThemeKey = keyof typeof THEMES;

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

export const isThemeKey = (v: unknown): v is ThemeKey => typeof v === "string" && v in THEMES;

const CSS_VARS: Record<string, keyof Palette> = {
  "--bg": "bg",
  "--bg-deep": "bgDeep",
  "--panel": "panel",
  "--panel2": "panel2",
  "--line": "line",
  "--line-soft": "lineSoft",
  "--hover": "hover",
  "--plate": "plate",
  "--text": "text",
  "--dim": "dim",
  "--faint": "faint",
  "--accent": "accent",
  "--good": "good",
  "--warn": "warn",
  "--bad": "bad",
  "--fresh": "fresh",
  "--cyan": "cyan",
};

/** Writes the theme's colours to CSS variables on the root element. */
export function applyTheme(key: ThemeKey, root: HTMLElement = document.documentElement): void {
  const t: Palette = THEMES[key];
  Object.entries(CSS_VARS).forEach(([cssVar, field]) => root.style.setProperty(cssVar, t[field]));
  root.style.colorScheme = key === "daylight" || key === "parchment" ? "light" : "dark";
}
