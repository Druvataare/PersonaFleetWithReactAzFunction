/* Baselines page (02 · WHAT THEY GET), checked against the wireframe's own
   buildModel and fitByPersona — including after baselines are edited. */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loadWireframe } from "../../mocks/data/wireframe.ts";
import { useUi } from "../../store/ui.ts";
import { renderApp } from "../../test/renderApp.tsx";

/* eslint-disable @typescript-eslint/no-explicit-any -- wireframe objects are untyped */
const wf = loadWireframe();
const KINDS = [
  ["fit", "Fit devices"],
  ["under", "Under provisioned"],
  ["over", "Over-provisioned"],
  ["crit", "Critically mismatched"],
] as const;

const fmt = (n: number) => n.toLocaleString();
const group = (name: string) => within(screen.getByRole("group", { name }));

/** Wireframe totals for a set of baselines. */
function wireframeFit(baselines: Record<string, any>) {
  const model = wf.buildModel(baselines);
  const rows = wf.fitByPersona(model);
  const total = rows.reduce((a: number, r: any) => a + r.total, 0);
  const tot = Object.fromEntries(KINDS.map(([k]) => [k, rows.reduce((a: number, r: any) => a + r[k], 0)]));
  return { model, rows, total, tot };
}

const openBaselines = async (pid = "DEV") => {
  const utils = renderApp(`/baselines/${pid}`);
  await screen.findByRole("group", { name: "Live impact" });
  return utils;
};

const slide = (label: string, value: number) =>
  act(() => {
    fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
  });

function expectTiles(baselines: Record<string, any>) {
  const { total, tot } = wireframeFit(baselines);
  expect(group("Total devices").getByText(fmt(total))).toBeInTheDocument();
  for (const [k, label] of KINDS) {
    const g = group(label);
    expect(g.getByText(fmt(tot[k]))).toBeInTheDocument();
    expect(g.getByText(`${((tot[k] / total) * 100).toFixed(1)}% of estate`)).toBeInTheDocument();
  }
}

describe("where the fleet stands", () => {
  it("fit tiles match the wireframe", async () => {
    await openBaselines();
    expectTiles(wf.DEFAULT_BASELINE);
    expect(group("Total devices").getByText("across 7 personas")).toBeInTheDocument();
  });

  it("fit legend matches the wireframe", async () => {
    await openBaselines();
    const { total, tot } = wireframeFit(wf.DEFAULT_BASELINE);
    const items = within(screen.getByRole("list", { name: "Fit status legend" })).getAllByRole("listitem");
    KINDS.forEach(([k, label], i) => {
      expect(items[i]).toHaveTextContent(`${label}${fmt(tot[k])}${((tot[k] / total) * 100).toFixed(1)}%`);
    });
    expect(screen.getByRole("img", { name: "Fit distribution by persona" })).toBeInTheDocument();
  });
});

describe("the contract", () => {
  it("shows the eight sliders at the persona's defaults", async () => {
    await openBaselines("CC");
    const b = wf.DEFAULT_BASELINE.CC;
    const expected: [string, number][] = [
      ["Minimum memory", b.ramGB],
      ["Minimum storage", b.storageGB],
      ["Minimum CPU index", b.cpuScore],
      ["Maximum boot time", b.bootSec],
      ["Maximum crashes / 30d", b.crashes],
      ["Minimum free disk", b.freePct],
      ["Minimum battery health", b.batteryPct],
      ["Ticket ceiling / 100 devices", b.ticketsPer100],
    ];
    for (const [label, v] of expected) expect(screen.getByLabelText(label)).toHaveValue(String(v));
    expect(screen.queryByText("UNSAVED CHANGES")).not.toBeInTheDocument();
    expect(screen.queryByText("EDITED")).not.toBeInTheDocument();
  });

  it("live impact matches the wireframe", async () => {
    await openBaselines("FIELD");
    const p = wireframeFit(wf.DEFAULT_BASELINE).model.find((x: any) => x.id === "FIELD");
    const impact = screen.getByRole("group", { name: "Live impact" });
    expect(impact).toHaveTextContent(`Devices below baseline${fmt(p.underCount)}`);
    expect(impact).toHaveTextContent(`Share of persona${Math.round(p.underPct * 100)}%`);
    expect(impact).toHaveTextContent(`Provisioning pillar${Math.round(p.pillars.prov)}`);
    expect(impact).toHaveTextContent(`Composite health${Math.round(p.health)}`);
  });

  it("moving sliders re-grades tiles, impact and tables exactly as the wireframe does", async () => {
    await openBaselines("DEV");
    slide("Minimum memory", 64);
    slide("Minimum CPU index", 90);
    slide("Ticket ceiling / 100 devices", 30);

    const edited = {
      ...wf.DEFAULT_BASELINE,
      DEV: { ...wf.DEFAULT_BASELINE.DEV, ramGB: 64, cpuScore: 90, ticketsPer100: 30 },
    };
    expectTiles(edited);
    const p = wireframeFit(edited).model.find((x: any) => x.id === "DEV");
    const impact = screen.getByRole("group", { name: "Live impact" });
    expect(impact).toHaveTextContent(`Devices below baseline${fmt(p.underCount)}`);
    expect(impact).toHaveTextContent(`Composite health${Math.round(p.health)}`);

    expect(screen.getByText("64GB")).toBeInTheDocument();
    expect(screen.getByText("UNSAVED CHANGES")).toBeInTheDocument();
    expect(screen.getByText("EDITED")).toBeInTheDocument();
  });

  it("storage shows terabytes", async () => {
    await openBaselines("KW");
    slide("Minimum storage", 2048);
    expect(screen.getByLabelText("Minimum storage")).toHaveAttribute("aria-valuetext", "2TB");
  });

  it("Reset restores the defaults for this persona only", async () => {
    const { user } = await openBaselines("DEV");
    slide("Minimum memory", 64);
    act(() => useUi.getState().setBaselineField("KW", wf.DEFAULT_BASELINE.KW, "ramGB", 32));
    await user.click(screen.getByRole("button", { name: "Reset Engineering" }));
    expect(screen.getByLabelText("Minimum memory")).toHaveValue("32");
    expect(screen.queryByText("UNSAVED CHANGES")).not.toBeInTheDocument();
    expect(useUi.getState().draftBaselines).toEqual({ KW: { ...wf.DEFAULT_BASELINE.KW, ramGB: 32 } });
  });

  it("the contract panel's Reset works too", async () => {
    const { user } = await openBaselines("DS");
    slide("Maximum boot time", 90);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Maximum boot time")).toHaveValue(String(wf.DEFAULT_BASELINE.DS.bootSec));
  });
});

describe("which component fails", () => {
  it("heat table lists personas worst first with CPU, RAM and SSD match", async () => {
    await openBaselines();
    const rows = [...wireframeFit(wf.DEFAULT_BASELINE).rows].sort(
      (a: any, b: any) => a.cpuPct + a.ramPct + a.ssdPct - (b.cpuPct + b.ramPct + b.ssdPct),
    );
    const body = within(screen.getByRole("table", { name: "Component match" }))
      .getAllByRole("row")
      .slice(1);
    expect(body.map((r) => r.textContent)).toEqual(
      rows.map((r: any) => `${r.name}${r.cpuPct}%${r.ramPct}%${r.ssdPct}%`),
    );
  });

  it("baseline reference is sorted by CPU and highlights edits", async () => {
    await openBaselines("EXEC");
    slide("Minimum memory", 64);
    const table = screen.getByRole("table", { name: "Baseline reference" });
    const body = within(table).getAllByRole("row").slice(1) as HTMLTableRowElement[];
    const order = Object.entries(wf.DEFAULT_BASELINE)
      .sort((a: any, b: any) => a[1].cpuScore - b[1].cpuScore)
      .map(([id]) => wf.PERSONA_DEFS.find((p: any) => p.id === id).name);
    expect(body.map((r) => r.cells[0].textContent)).toEqual(order);
    const exec = body.find((r) => r.cells[0].textContent === "Executive")!;
    expect(exec.cells[2]).toHaveTextContent("64 GB");
    expect(exec.cells[2].getAttribute("style")).toContain("color");
    expect(exec.cells[2].style.color).not.toBe("var(--dim)");
    expect(exec.cells[3].style.color).toBe("var(--dim)");
  });

  it("clicking a table row or the persona strip opens that persona's contract", async () => {
    const { user, router } = await openBaselines("DEV");
    const heatRow = within(screen.getByRole("table", { name: "Component match" }))
      .getByText("Data Science")
      .closest("tr")!;
    await user.click(heatRow);
    expect(router.state.location.pathname).toBe("/baselines/DS");
    await user.click(
      within(screen.getByRole("group", { name: "Choose persona" })).getByRole("button", {
        name: "Creative Studio",
      }),
    );
    expect(router.state.location.pathname).toBe("/baselines/CRE");
    expect(await screen.findByText("Baseline contract · Creative Studio")).toBeInTheDocument();
  });
});

describe("app catalogue and the rest of the app", () => {
  it("lists the persona's catalogue", async () => {
    await openBaselines("DS");
    const list = within(screen.getByRole("list", { name: "Data Science app catalogue" }));
    /* Every catalogue app, then the (disabled) Add app control as the last item. */
    expect(list.getAllByRole("listitem").map((li) => li.textContent?.trim())).toEqual([
      ...wf.APPS.DS,
      "Add app",
    ]);
    expect(list.getByRole("button", { name: /Add app/ })).toBeDisabled();
  });

  it("an edited baseline changes the persona page and the Personas grid", async () => {
    const { router } = await openBaselines("CC");
    slide("Minimum memory", 32);
    const edited = { ...wf.DEFAULT_BASELINE, CC: { ...wf.DEFAULT_BASELINE.CC, ramGB: 32 } };
    const cc = wf.buildModel(edited).find((x: any) => x.id === "CC");

    await act(() => router.navigate("/personas/CC"));
    await waitFor(() => expect(group("Below baseline").getByText(fmt(cc.underCount))).toBeInTheDocument());
    expect(screen.getByText(`Baseline · 32GB RAM · 256GB disk · CPU 50 · boot ≤50s`)).toBeInTheDocument();

    await act(() => router.navigate("/personas"));
    const card = await screen.findByRole("link", { name: /Contact Centre/ });
    expect([...card.querySelectorAll("text")].at(-1)?.textContent).toBe(String(Math.round(cc.health)));
  });

  it("unknown persona shows not found", async () => {
    renderApp("/baselines/NOPE");
    expect(await screen.findByRole("heading", { name: 'Persona "NOPE" does not exist' })).toBeInTheDocument();
  });
});
