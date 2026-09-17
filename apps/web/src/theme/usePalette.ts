import { healthTone } from "@pfc/scoring";
import { useUi } from "../store/ui.ts";
import { THEMES, type Palette } from "./themes.ts";

/** Active theme colours as hex values, for SVG attributes and D3 colour scales. */
export const usePalette = (): Palette => THEMES[useUi((s) => s.theme)];

/** Health band colour: 85+ good, 70–84 warn, below 70 bad. */
export const bandColor = (v: number, C: Palette): string => C[healthTone(v)];
