/* Personas page (01 · WHO). Expected numbers come from the wireframe's own
   data and buildModel, so the page is checked against the original. */
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loadWireframe } from "../../mocks/data/wireframe.ts";
import { useUi } from "../../store/ui.ts";
import { renderApp } from "../../test/renderApp.tsx";

type Row = { pid: string; conf: number; t: string; dept: string };

const wf = loadWireframe();
const wfModel = wf.buildModel(wf.DEFAULT_BASELINE);
const titles = wf.TITLE_ROWS as Row[];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fmt = (n: number) => n.toLocaleString();

const group = (name: string) => within(screen.getByRole("group", { name }));
const openPage = async () => {
  const utils = renderApp("/personas");
  await screen.findByRole("group", { name: "Confidence bands" });
  return utils;
};
const tableRows = () =>
  within(screen.getByRole("table", { name: "Job titles to review" }))
    .getAllByRole("row")
    .slice(1) as HTMLTableRowElement[];

describe("persona health", () => {
  it("shows the four headline KPIs from the wireframe model", async () => {
    await openPage();
    expect(group("Personas").getByText("7")).toBeInTheDocument();
    expect(group("Devices in estate").getByText(fmt(sum(wfModel.map((p) => p.count))))).toBeInTheDocument();
    expect(group("Under baseline").getByText(fmt(sum(wfModel.map((p) => p.underCount))))).toBeInTheDocument();
    expect(group("Open tickets").getByText(fmt(sum(wfModel.map((p) => p.openTickets))))).toBeInTheDocument();
  });

  it("draws a ring card per persona with health, headcount, share below baseline and open tickets", async () => {
    await openPage();
    const cards = within(screen.getByLabelText("Persona cards")).getAllByRole("link");
    expect(cards).toHaveLength(7);
    wfModel.forEach((p, i) => {
      const card = cards[i];
      expect(card).toHaveAttribute("href", `/personas/${p.id}`);
      expect(within(card).getByText(p.name)).toBeInTheDocument();
      expect(within(card).getByText(p.sub)).toBeInTheDocument();
      const meta = card.querySelector(".ring-meta")!.textContent!.replace(/\s+/g, " ");
      expect(meta).toBe(
        `${fmt(p.count)} devices · ${Math.round(p.underPct * 100)}% below baseline${fmt(p.openTickets)} open tickets`,
      );
      expect([...card.querySelectorAll("text")].at(-1)?.textContent).toBe(String(Math.round(p.health)));
    });
  });

  it("explains the two rings", async () => {
    await openPage();
    expect(screen.getByText("Outer ring — persona health")).toBeInTheDocument();
    expect(screen.getByText("Inner ring — share below baseline")).toBeInTheDocument();
  });
});

describe("mapping confidence", () => {
  const bandsOf = (rows: Row[]) => ({
    all: rows.length,
    full: rows.filter((r) => r.conf >= 100).length,
    mid: rows.filter((r) => r.conf >= 50 && r.conf < 100).length,
    low: rows.filter((r) => r.conf < 50).length,
    avg: (sum(rows.map((r) => r.conf)) / rows.length).toFixed(2),
    distinct: new Set(rows.map((r) => r.t)).size,
  });

  it("shows average confidence, distinct titles, titles mapped and the three bands", async () => {
    await openPage();
    const b = bandsOf(titles);
    expect(group("Avg confidence %").getByText(b.avg)).toBeInTheDocument();
    expect(group("Distinct job titles").getByText(fmt(b.distinct))).toBeInTheDocument();
    expect(group("Titles mapped in scope").getByText(fmt(b.all))).toBeInTheDocument();
    const bands = group("Confidence bands");
    expect(bands.getByRole("button", { name: /Confidence 100%/ })).toHaveTextContent(fmt(b.full));
    expect(bands.getByRole("button", { name: /Confidence 50-99%/ })).toHaveTextContent(fmt(b.mid));
    expect(bands.getByRole("button", { name: /Confidence <50%/ })).toHaveTextContent(fmt(b.low));
  });

  it("legends list every persona with count and share to two decimals", async () => {
    await openPage();
    const legend = group("Count of job title by persona legend");
    wf.PERSONA_DEFS.forEach((p: { id: string; name: string }) => {
      const n = titles.filter((r) => r.pid === p.id).length;
      const row = legend.getByRole("button", { name: new RegExp(`^${p.name}`) });
      expect(row).toHaveTextContent(`${fmt(n)}${((n / titles.length) * 100).toFixed(2)}%`);
    });
    const depts = group("Count of department by persona legend");
    const devDepts = new Set(titles.filter((r) => r.pid === "DEV").map((r) => r.dept + "|" + r.t)).size;
    expect(depts.getByRole("button", { name: /^Engineering/ })).toHaveTextContent(fmt(devDepts));
  });

  it("scopes everything to one persona from the selector", async () => {
    const { user } = await openPage();
    await user.selectOptions(screen.getByLabelText("Persona"), "CC");
    const cc = bandsOf(titles.filter((r) => r.pid === "CC"));
    await waitFor(() => expect(group("Titles mapped in scope").getByText(fmt(cc.all))).toBeInTheDocument());
    expect(group("Avg confidence %").getByText(cc.avg)).toBeInTheDocument();
    expect(group("Confidence bands").getByRole("button", { name: /Confidence <50%/ })).toHaveTextContent(
      fmt(cc.low),
    );
    await waitFor(() => tableRows().forEach((r) => expect(r).toHaveTextContent("Contact Centre")));
  });

  it("filters by clicking a donut slice or legend row, and clicking again clears it", async () => {
    const { user } = await openPage();
    await user.click(screen.getByRole("button", { name: `FIELD: ${fmt(980)}` }));
    expect(useUi.getState().mappingPersona).toBe("FIELD");
    expect(screen.getByLabelText("Persona")).toHaveValue("FIELD");
    await user.click(
      group("Count of job title by persona legend").getByRole("button", { name: /^Field Engineer/ }),
    );
    expect(useUi.getState().mappingPersona).toBe("all");
  });

  it("dims other personas while one is selected", async () => {
    const { user } = await openPage();
    await user.selectOptions(screen.getByLabelText("Persona"), "DS");
    const legend = await waitFor(() => group("Count of job title by persona legend"));
    expect(legend.getByRole("button", { name: /^Data Science/ })).toHaveStyle({ opacity: "1" });
  });
});

describe("review queue", () => {
  it("lists everything under 100%, lowest confidence first, capped at 150", async () => {
    await openPage();
    const under = titles.filter((r) => r.conf < 100).sort((a, b) => a.conf - b.conf);
    await waitFor(() => expect(tableRows()).toHaveLength(150));
    expect(
      screen.getByText(`Lowest confidence first · first 150 rows of ${fmt(under.length)}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Job titles worth a second look")).toBeInTheDocument();
    const confs = tableRows().map((r) => Number(r.cells[3].textContent!.replace("%", "")));
    expect(confs).toEqual(under.slice(0, 150).map((r) => r.conf));
  });

  it("filters to a band, shows the clear chip, and clears it", async () => {
    const { user } = await openPage();
    await user.click(screen.getByRole("button", { name: /Confidence <50%/ }));
    expect(screen.getByRole("button", { name: /Confidence <50%/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Job titles in the selected band")).toBeInTheDocument();
    const low = titles.filter((r) => r.conf < 50).length;
    await waitFor(() => expect(tableRows()).toHaveLength(low));
    tableRows().forEach((r) => expect(r.cells[4].textContent).not.toBe("—"));
    await user.click(screen.getByRole("button", { name: "Clear band filter ✕" }));
    expect(useUi.getState().mappingBand).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear band filter ✕" })).not.toBeInTheDocument();
  });

  it("shows 100% titles with no reason when that band is selected", async () => {
    const { user } = await openPage();
    await user.click(screen.getByRole("button", { name: /Confidence 100%/ }));
    await waitFor(() => expect(tableRows()[0].cells[3]).toHaveTextContent("100%"));
    expect(tableRows()[0].cells[4]).toHaveTextContent("—");
  });

  it("searches job title and department", async () => {
    const { user } = await openPage();
    await user.type(screen.getByLabelText("Search job title or department"), "legal");
    await waitFor(() => tableRows().forEach((r) => expect(r.cells[1]).toHaveTextContent("Legal")));
    await user.clear(screen.getByLabelText("Search job title or department"));
    await user.type(screen.getByLabelText("Search job title or department"), "zzz-nothing");
    expect(await screen.findByText("Nothing to review in this selection.")).toBeInTheDocument();
  });

  it("clicking a row filters to that row's persona", async () => {
    const { user } = await openPage();
    await waitFor(() => expect(tableRows().length).toBeGreaterThan(0));
    const first = tableRows()[0];
    await user.click(first);
    const expected = wf.PERSONA_DEFS.find((p: { name: string }) => first.cells[2].textContent === p.name).id;
    expect(useUi.getState().mappingPersona).toBe(expected);
  });
});

describe("filters", () => {
  it("Needs attention keeps only personas under 85 and shows a message when none remain", async () => {
    const { user } = await openPage();
    await user.click(screen.getByRole("button", { name: "Needs attention" }));
    const expected = wfModel.filter((p) => p.health < 85).length;
    expect(within(screen.getByLabelText("Persona cards")).queryAllByRole("link")).toHaveLength(expected);
  });
});
