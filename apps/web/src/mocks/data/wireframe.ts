/* Test helper: runs the wireframe's own data and scoring code from
   reference/personalfleet.html, so tests can compare against the original. */
import * as d3 from "d3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WIREFRAME_PATH = fileURLToPath(
  new URL("../../../../../reference/personalfleet.html", import.meta.url),
);

function section(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Wireframe section not found: ${start}`);
  return html.slice(from, to);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the wireframe is untyped JavaScript */
export interface Wireframe {
  PERSONA_DEFS: any[];
  APPS: Record<string, string[]>;
  DEFAULT_BASELINE: Record<string, any>;
  WEIGHTS: Record<string, any>;
  RAW: any[];
  MIGRATIONS: any[];
  EXCEPTIONS: any[];
  TITLE_ROWS: any[];
  INCIDENTS: any[];
  REQUESTS: any[];
  buildModel: (baselines: Record<string, any>) => any[];
  fitByPersona: (model: any[]) => any[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cached: Wireframe | null = null;

/** Loads data, scoring (THEMES…ICONS) and fit analysis sections of the wireframe script. */
export function loadWireframe(): Wireframe {
  if (cached) return cached;
  const html = readFileSync(WIREFRAME_PATH, "utf8");
  const core = section(
    html,
    "/* ---------------------------- THEMES",
    "/* ----------------------------- ICONS",
  );
  const fit = section(html, "/* ---------------- DEVICE FIT ANALYSIS", "function fitDonut");
  const factory = new Function(
    "d3",
    `${core}\nlet model;\n${fit}\nreturn { PERSONA_DEFS, APPS, DEFAULT_BASELINE, WEIGHTS, RAW, MIGRATIONS, EXCEPTIONS,
      TITLE_ROWS, INCIDENTS, REQUESTS, buildModel, fitByPersona: (m) => { model = m; return fitByPersona(); } };`,
  ) as (lib: typeof d3) => Wireframe;
  cached = factory(d3);
  return cached;
}
