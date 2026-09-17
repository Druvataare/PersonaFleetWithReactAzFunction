/* Chart parity: render each chart with the wireframe's own chart function and
   with the React component, then compare every drawn shape (Midnight theme,
   motion off, so both show their final state). */
import { buildModel, fitByPersona, FIT_KINDS, healthTone, type PersonaModel } from "@pfc/scoring";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { ageByPriority, tally } from "../lib/aggregate.ts";
import { TICKET_CATS } from "../lib/categories.ts";
import { personaTrend } from "../lib/trend.ts";
import { ticketSummary } from "../mocks/aggregate.ts";
import { generateFleetData } from "../mocks/data/generate.ts";
import { loadWireframe } from "../mocks/data/wireframe.ts";
import { THEMES } from "../theme/themes.ts";
import { incidentCategoryColor, ticketCategoryColor } from "./colors.ts";
import {
  BarList,
  BaselineHistogram,
  BinHistogram,
  BootScatter,
  Bullet,
  ComplianceBySite,
  Donut,
  FitStack,
  MigrationFlow,
  PersonaRing,
  PillarGauge,
  StackedAge,
  TrendArea,
  WeekBars,
} from "./index.ts";

const wf = loadWireframe();
const C = THEMES.midnight;
const data = generateFleetData();
let model: PersonaModel[];

beforeAll(() => {
  model = buildModel({
    personas: data.personas,
    devicesByPersona: data.devicesByPersona,
    baselines: data.defaultBaselines,
    weights: data.weights,
    migrations: data.migrations,
    exceptions: data.exceptions,
  });
});

const ATTRS = [
  "d",
  "x",
  "y",
  "width",
  "height",
  "rx",
  "cx",
  "cy",
  "r",
  "x1",
  "y1",
  "x2",
  "y2",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "opacity",
  "transform",
  "text-anchor",
  "font-size",
  "offset",
  "stop-color",
  "stop-opacity",
  "viewBox",
];

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const normNumbers = (s: string) => s.replace(/-?\d*\.?\d+(e-?\d+)?/g, (m) => String(round(Number(m))));

/** Every drawn element as {tag, attributes…, text}, numbers rounded, ids ignored. */
function shapes(root: Element) {
  return [...root.querySelectorAll("svg, path, rect, circle, line, text, stop")].map((el) => {
    const o: Record<string, string> = { tag: el.tagName.toLowerCase() };
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v === null) continue;
      o[a] = /^url\(#/.test(v) ? "url(#gradient)" : normNumbers(v.trim());
    }
    if (el.tagName.toLowerCase() === "text") o.text = (el.textContent ?? "").replace(/,/g, "");
    return o;
  });
}

function wireframeShapes(markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return shapes(host);
}

function reactShapes(node: React.ReactElement) {
  const { container, unmount } = render(node);
  const out = shapes(container);
  unmount();
  return out;
}

const persona = (id: string) => model.find((p) => p.id === id)!;
const wfModel = () => wf.buildModel(wf.DEFAULT_BASELINE);

describe("charts match the wireframe shape for shape", () => {
  it.each(["DEV", "CC", "EXEC"])("persona ring · %s", (id) => {
    const p = persona(id);
    const want = wireframeShapes(wf.charts.personaRing(wfModel().find((x) => x.id === id)));
    expect(reactShapes(<PersonaRing pid={id} health={p.health} underPct={p.underPct} />)).toEqual(want);
  });

  it("persona ring at 110px", () => {
    const p = persona("FIELD");
    const want = wireframeShapes(
      wf.charts.personaRing(
        wfModel().find((x) => x.id === "FIELD"),
        110,
      ),
    );
    expect(
      reactShapes(<PersonaRing pid="FIELD" health={p.health} underPct={p.underPct} size={110} />),
    ).toEqual(want);
  });

  it("pillar gauge", () => {
    const p = persona("KW");
    expect(reactShapes(<PillarGauge pillars={p.pillars} size={180} />)).toEqual(
      wireframeShapes(wf.charts.pillarGauge(p.pillars, 180)),
    );
  });

  it.each([
    ["ramGB", "RAM (GB)"],
    ["storageGB", "DISK (GB)"],
  ] as const)("baseline histogram · %s", (field, label) => {
    const p = persona("CC");
    const want = wireframeShapes(
      wf.charts.baselineHistogram(p.devices, field, p.baseline[field], label, "GB"),
    );
    expect(
      reactShapes(
        <BaselineHistogram
          values={p.devices.map((d) => d[field])}
          baseValue={p.baseline[field]}
          label={label}
          unit="GB"
        />,
      ),
    ).toEqual(want);
  });

  it("binned histogram · device health and CPU", () => {
    const p = persona("DS");
    const scores = p.devices.map((d) => d.score);
    const want1 = wireframeShapes(
      wf.charts.binHistogram(
        scores,
        [50, 60, 70, 80, 90],
        (bn: { x0: number }) => Math.round(bn.x0),
        (bn: { x0: number; x1: number }) => C[healthTone((bn.x0 + bn.x1) / 2)],
        "DEVICE HEALTH SCORE",
      ),
    );
    expect(
      reactShapes(
        <BinHistogram
          values={scores}
          thresholds={[50, 60, 70, 80, 90]}
          binLabel={(bn) => Math.round(bn.x0 ?? 0)}
          binColor={(bn) => C[healthTone(((bn.x0 ?? 0) + (bn.x1 ?? 0)) / 2)]}
          label="DEVICE HEALTH SCORE"
        />,
      ),
    ).toEqual(want1);

    const cpu = p.devices.map((d) => d.cpuScore);
    const cpuColor = (x0: number, x1: number) => ((x0 + x1) / 2 >= p.baseline.cpuScore ? C.good : C.bad);
    const want2 = wireframeShapes(
      wf.charts.binHistogram(
        cpu,
        [40, 50, 60, 70, 80, 90],
        (bn: { x0: number }) => Math.round(bn.x0),
        (bn: { x0: number; x1: number }) => cpuColor(bn.x0, bn.x1),
        "CPU BENCHMARK INDEX",
      ),
    );
    expect(
      reactShapes(
        <BinHistogram
          values={cpu}
          thresholds={[40, 50, 60, 70, 80, 90]}
          binLabel={(bn) => Math.round(bn.x0 ?? 0)}
          binColor={(bn) => cpuColor(bn.x0 ?? 0, bn.x1 ?? 0)}
          label="CPU BENCHMARK INDEX"
        />,
      ),
    ).toEqual(want2);
  });

  it("boot time against free disk scatter", () => {
    const p = persona("FIELD");
    expect(reactShapes(<BootScatter devices={p.devices} baseline={p.baseline} />)).toEqual(
      wireframeShapes(wf.charts.scatter(p.devices, p.baseline)),
    );
  });

  it("stacked age by priority", () => {
    const p = persona("CC");
    const tickets = p.devices.flatMap((d) => d.tickets);
    expect(reactShapes(<StackedAge buckets={ageByPriority(tickets)} />)).toEqual(
      wireframeShapes(wf.charts.stackedAge(tickets)),
    );
  });

  it("patch compliance by site", () => {
    const p = persona("KW");
    expect(reactShapes(<ComplianceBySite devices={p.devices} />)).toEqual(
      wireframeShapes(wf.charts.complianceBySite(p.devices)),
    );
  });

  it.each([null, "Hardware"])("persona ticket mix donut · active %s", (active) => {
    const p = persona("DEV");
    const tickets = p.devices.flatMap((d) => d.tickets);
    const byCat = TICKET_CATS.map((c) => ({ cat: c, n: tickets.filter((t) => t.cat === c).length })).filter(
      (d) => d.n,
    );
    const color = incidentCategoryColor(C);
    const want = wireframeShapes(wf.charts.ticketDonut(byCat, active, 160));
    const got = reactShapes(
      <Donut
        rows={byCat.map((d) => ({ key: d.cat, n: d.n, color: color(d.cat) }))}
        centerLabel="TICKETS"
        size={160}
        thickness={24}
        padAngle={0.02}
        dimOpacity={0.25}
        delayStep={70}
        centerSize={22}
        active={active}
      />,
    );
    expect(got).toEqual(want);
  });

  it.each([
    ["inc", null],
    ["req", "Memory Upgrade"],
  ] as const)("tickets page donut · %s · active %s", (kind, active) => {
    const summary = ticketSummary(
      kind === "inc" ? data.incidents : data.requests,
      data.personas,
      kind,
      null,
      null,
    );
    const rows = summary.byCategory;
    wf.charts.setTicketCategory(active);
    const want = wireframeShapes(wf.charts.ticketDonutT(rows, 190));
    const color = ticketCategoryColor(C);
    expect(
      reactShapes(
        <Donut
          rows={rows.map((d) => ({ key: d.k, n: d.n, color: color(d.k) }))}
          centerLabel="TICKETS"
          delayStep={55}
          active={active}
        />,
      ),
    ).toEqual(want);
  });

  it("persona donut", () => {
    const rows = data.personas.map((p) => ({
      k: p.id,
      n: data.titleRows.filter((r) => r.pid === p.id).length,
    }));
    const want = wireframeShapes(wf.charts.personaDonut(rows, "TITLES", 190, "CC"));
    expect(
      reactShapes(
        <Donut
          rows={rows.map((d) => ({ key: d.k, n: d.n, color: data.personas.find((p) => p.id === d.k)!.hue }))}
          centerLabel="TITLES"
          active="CC"
        />,
      ),
    ).toEqual(want);
  });

  it("week bars", () => {
    const weeks = ticketSummary(data.incidents, data.personas, "inc", null, null).weeks;
    expect(reactShapes(<WeekBars series={weeks} color={C.warn} />)).toEqual(
      wireframeShapes(wf.charts.weekBars(weeks, C.warn)),
    );
  });

  it("health trend area", () => {
    const p = persona("CRE");
    const series = personaTrend(p.id, p.health);
    expect(reactShapes(<TrendArea series={series} color={p.hue} />)).toEqual(
      wireframeShapes(wf.charts.trendArea(series, p.hue)),
    );
  });

  it("bullet charts", () => {
    const p = persona("DEV");
    const d = p.devices[3];
    const cases = [
      ["Memory", d.ramGB, p.baseline.ramGB, Math.max(p.baseline.ramGB, d.ramGB) * 1.15, "GB", false, "ram"],
      [
        "Boot time",
        d.bootSec,
        p.baseline.bootSec,
        Math.max(p.baseline.bootSec, d.bootSec) * 1.15,
        "s",
        true,
        "clock",
      ],
    ] as const;
    for (const [label, actual, target, max, unit, invert, icon] of cases) {
      const want = wireframeShapes(wf.charts.bullet(label, actual, target, max, unit, invert, icon));
      expect(
        reactShapes(
          <Bullet
            label={label}
            actual={actual}
            target={target}
            max={max}
            unit={unit}
            invert={invert}
            icon={icon}
          />,
        ),
        label,
      ).toEqual(want);
    }
  });

  it("bar list widths", () => {
    const rows = tally(
      persona("FIELD").devices.flatMap((d) => d.tickets),
      (t) => t.short,
    ).slice(0, 6);
    const host = document.createElement("div");
    host.innerHTML = wf.charts.barList(rows, C.warn);
    const want = [...host.querySelectorAll<HTMLElement>(".bar-fill")].map((el) =>
      round(parseFloat(el.style.width)),
    );
    const { container } = render(<BarList rows={rows} color={C.warn} />);
    const got = [...container.querySelectorAll<HTMLElement>(".bar-fill")].map((el) =>
      round(parseFloat(el.style.width)),
    );
    expect(got).toEqual(want);
    expect(container.textContent).toContain(rows[0].k);
  });

  it("migration flow", () => {
    expect(reactShapes(<MigrationFlow migrations={data.migrations} personas={data.personas} />)).toEqual(
      wireframeShapes(wf.charts.migrationFlow()),
    );
  });

  it("fit donut and fit stack", () => {
    const fit = fitByPersona(model);
    const tot = Object.fromEntries(FIT_KINDS.map(({ key }) => [key, fit.reduce((a, r) => a + r[key], 0)]));
    const rows = FIT_KINDS.map(({ key, tone }) => ({ key, n: tot[key], color: C[tone] })).filter((d) => d.n);
    expect(
      reactShapes(
        <Donut
          rows={rows}
          centerLabel="DEVICES"
          size={180}
          thickness={28}
          dimOpacity={0.92}
          delayStep={70}
        />,
      ),
    ).toEqual(wireframeShapes(wf.charts.fitDonut(tot, 180)));
    expect(reactShapes(<FitStack rows={fit} />)).toEqual(
      wireframeShapes(wf.charts.fitStack(wf.fitByPersona(wfModel()))),
    );
  });
});

describe("the comparison is sensitive", () => {
  it("sees every shape and catches a one-point change", () => {
    const p = persona("DEV");
    const want = wireframeShapes(wf.charts.personaRing(wfModel().find((x) => x.id === "DEV")));
    const got = reactShapes(<PersonaRing pid="DEV" health={p.health} underPct={p.underPct} />);
    // plate, track, 2 arcs, 24 ticks, avatar (svg + 3 shapes), number
    expect(want.length).toBeGreaterThanOrEqual(30);
    expect(got).toEqual(want);
    expect(reactShapes(<PersonaRing pid="DEV" health={p.health + 1} underPct={p.underPct} />)).not.toEqual(
      want,
    );
    expect(reactShapes(<PersonaRing pid="KW" health={p.health} underPct={p.underPct} />)).not.toEqual(want);
    const fitRows = fitByPersona(model);
    expect(reactShapes(<FitStack rows={fitRows.slice(1)} />)).not.toEqual(
      wireframeShapes(wf.charts.fitStack(wf.fitByPersona(wfModel()))),
    );
  });
});
