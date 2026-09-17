/* Test helper: runs the wireframe's own data and scoring code from
   reference/personalfleet.html, so tests can compare against the original. */
import * as d3 from "d3";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walks up from the working directory to the repo's reference/personalfleet.html
    (import.meta.url is not a file URL in jsdom test environments). */
function findWireframe(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, "reference", "personalfleet.html");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("reference/personalfleet.html not found");
    dir = parent;
  }
}

export const WIREFRAME_PATH = findWireframe();

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
  /** The wireframe's chart functions; each returns an HTML/SVG string (Midnight theme). */
  charts: Record<string, (...args: any[]) => string> & { setTicketCategory: (cat: string | null) => void };
  /** The wireframe's persona-switch impact metrics, graded against its default baselines. */
  swMetrics: (device: any, from: string, to: string) => any;
  TASKS_AUTO: Record<string, number>;
  ONBOARD_DAYS: Record<string, number>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cached: Wireframe | null = null;

const CHART_FNS = [
  "avatar",
  "personaRing",
  "pillarGauge",
  "baselineHistogram",
  "binHistogram",
  "scatter",
  "stackedAge",
  "complianceBySite",
  "ticketDonut",
  "ticketDonutT",
  "weekBars",
  "personaDonut",
  "trendArea",
  "bullet",
  "barList",
  "migrationFlow",
  "fitDonut",
  "fitStack",
];

/** Loads data, scoring (THEMES…ICONS), icons and charts, and the fit analysis sections of the wireframe script. */
export function loadWireframe(): Wireframe {
  if (cached) return cached;
  const html = readFileSync(WIREFRAME_PATH, "utf8");
  const core = section(
    html,
    "/* ---------------------------- THEMES",
    "/* ----------------------------- ICONS",
  );
  const charts = section(
    html,
    "/* ----------------------------- ICONS",
    "/* ------------------------- SMALL BUILDERS",
  );
  const fit = section(html, "/* ---------------- DEVICE FIT ANALYSIS", "function fitBlock");
  const switching = section(
    html,
    "/* ===================== PERSONA SWITCH",
    "/* ===================== EXCEL DATA LINK",
  );
  const factory = new Function(
    "d3",
    `const MONO = 'ui-monospace,SFMono-Regular,"JetBrains Mono",Menlo,monospace';\n${core}\n${charts}\nlet model;\nconst state = { tcat: null, baselines: JSON.parse(JSON.stringify(DEFAULT_BASELINE)) };\n${fit}\n${switching}
    return { PERSONA_DEFS, APPS, DEFAULT_BASELINE, WEIGHTS, RAW, MIGRATIONS, EXCEPTIONS,
      TITLE_ROWS, INCIDENTS, REQUESTS, buildModel, fitByPersona: (m) => { model = m; return fitByPersona(); },
      swMetrics, TASKS_AUTO, ONBOARD_DAYS,
      charts: { ${CHART_FNS.join(", ")}, setTicketCategory: (c) => { state.tcat = c; } } };`,
  ) as (lib: typeof d3) => Wireframe;
  cached = factory(d3);
  return cached;
}
