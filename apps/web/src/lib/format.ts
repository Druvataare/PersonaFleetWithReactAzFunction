/** Storage size as the wireframe shows it: 1024 → "1TB", 512 → "512GB". */
export const gb = (v: number): string => (v >= 1024 ? v / 1024 + "TB" : v + "GB");

/** Integers with thousands separators; decimals with fixed places. */
export const formatNum = (v: number, dec = 0): string =>
  dec ? v.toFixed(dec) : Math.round(v).toLocaleString();

export type ToneOrAccent = "good" | "warn" | "bad" | "accent";

/** CSS colour for a semantic tone, following the active theme. */
export const toneColor = (tone?: ToneOrAccent | null): string => (tone ? `var(--${tone})` : "var(--text)");
