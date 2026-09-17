/* WCAG contrast helpers for colours computed at runtime (e.g. text on a tinted cell). */

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb) =>
  "#" +
  c
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two #RRGGBB colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` at `alpha` (0–1) painted over `bottom`. */
export function blend(top: string, bottom: string, alpha: number): string {
  const t = toRgb(top);
  const b = toRgb(bottom);
  return toHex(t.map((v, i) => b[i] + (v - b[i]) * alpha) as Rgb);
}

/** Moves `fg` toward `toward` in small steps until it reaches `min` contrast on `bg`. */
export function readableOn(fg: string, bg: string, toward: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const a = toRgb(fg);
  const t = toRgb(toward);
  for (let k = 0.02; k <= 1; k += 0.02) {
    const c = toHex(a.map((v, i) => v + (t[i] - v) * k) as Rgb);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return toward;
}
