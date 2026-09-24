/* The domains come from /api/catalog, not from a constant here (AD-10): this
   estate's incident categories are its own remediation rules -- OneDrive
   sync, Browser, Network and so on -- not the wireframe's invented six, and
   a hardcoded domain would silently colour real categories grey. Passed in
   rather than defaulted, so a caller cannot forget and quietly fall back to
   a list that no longer describes the data.

   A domain longer than the range recycles colours, which d3 does by design
   and is the right failure: repeated colours, never missing ones. */
import { scaleOrdinal } from "d3-scale";
import type { Palette } from "../theme/themes.ts";

/** Colour for an incident category (the persona page's ticket mix). */
export const incidentCategoryColor = (C: Palette, cats: readonly string[]) =>
  scaleOrdinal<string, string>()
    .domain(cats)
    .range([C.bad, C.warn, C.accent, C.cyan, C.good, C.fresh]);

/** Colour for an incident category or catalog item (the Tickets page). */
export const ticketCategoryColor = (C: Palette, cats: readonly string[]) =>
  scaleOrdinal<string, string>()
    .domain(cats)
    .range([
      C.bad,
      C.warn,
      C.accent,
      C.cyan,
      C.good,
      C.fresh,
      "#E0A458",
      "#5AD1C8",
      "#C4649B",
      "#6E7BF2",
      "#22A57F",
      "#9B5FE0",
      "#D98429",
      "#2FA9C9",
    ]);
