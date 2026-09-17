import { scaleOrdinal } from "d3-scale";
import { CATALOG, TICKET_CATS } from "../lib/categories.ts";
import type { Palette } from "../theme/themes.ts";

/** Colour for an incident category (the persona page's ticket mix). */
export const incidentCategoryColor = (C: Palette) =>
  scaleOrdinal<string, string>()
    .domain(TICKET_CATS)
    .range([C.bad, C.warn, C.accent, C.cyan, C.good, C.fresh]);

/** Colour for an incident category or catalog item (the Tickets page). */
export const ticketCategoryColor = (C: Palette) =>
  scaleOrdinal<string, string>()
    .domain(TICKET_CATS.concat(CATALOG))
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
