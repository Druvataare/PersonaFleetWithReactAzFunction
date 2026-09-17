/* Tickets page (03 · WHAT IT COSTS), checked against the wireframe's incidents,
   requests, persona counts and ticket ceilings. */
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tally } from "../../lib/aggregate.ts";
import { loadWireframe } from "../../mocks/data/wireframe.ts";
import { useUi } from "../../store/ui.ts";
import { renderApp } from "../../test/renderApp.tsx";

/* eslint-disable @typescript-eslint/no-explicit-any -- wireframe objects are untyped */
const wf = loadWireframe();
const fmt = (n: number) => n.toLocaleString();
const group = (name: string) => within(screen.getByRole("group", { name }));

/** The wireframe's screenTickets numbers for a mode, persona filter, category filter and baselines. */
function expected(
  kind: "inc" | "req",
  pid = "all",
  cat: string | null = null,
  baselines = wf.DEFAULT_BASELINE,
) {
  const set: any[] = kind === "inc" ? wf.INCIDENTS : wf.REQUESTS;
  let rows = set;
  if (pid !== "all") rows = rows.filter((t) => t.pid === pid);
  if (cat) rows = rows.filter((t) => t.cat === cat);
  const model: any[] = wf.buildModel(baselines);
  const scope = pid === "all" ? model : model.filter((p) => p.id === pid);
  const users = scope.reduce((a, p) => a + p.count, 0);
  const avgBase = scope.reduce((a, p) => a + baselines[p.id].ticketsPer100 / 100, 0) / scope.length;
  const personaRows = model.map((p) => {
    const n = set.filter((t) => t.pid === p.id).length;
    const per = n / p.count;
    const b = baselines[p.id].ticketsPer100 / 100;
    const status = per <= b ? "Within baseline" : per <= b * 1.5 ? "Near baseline" : "Over baseline";
    return { id: p.id, name: p.name, n, per, b, variance: per - b, status };
  });
  const scoped = personaRows.filter((r) => pid === "all" || r.id === pid);
  return {
    total: rows.length,
    unique: new Set(rows.map((t) => t.uid)).size,
    per: users ? rows.length / users : 0,
    avgBase,
    over: scoped.filter((r) => r.variance > r.b * 0.5).length,
    worst: Math.max(...scoped.map((r) => r.variance)),
    open: rows.filter((t) => t.open).length,
    sla: rows.filter((t) => t.sla).length,
    byCat: tally(rows, (t) => t.cat),
    depts: tally(rows, (t) => t.dept).slice(0, 10),
    personaRows: scoped.sort((a, b) => b.variance - a.variance),
  };
}

const openTickets = async () => {
  const utils = renderApp("/tickets");
  await screen.findByRole("table", { name: "Persona ticket health" });
  return utils;
};

function expectKpis(e: ReturnType<typeof expected>, label: string) {
  expect(group(`Total ${label}`).getByText(fmt(e.total))).toBeInTheDocument();
  expect(group("Unique requestors").getByText(fmt(e.unique))).toBeInTheDocument();
  expect(group("Per user").getByText(e.per.toFixed(2))).toBeInTheDocument();
  expect(group("Ticket baseline").getByText(e.avgBase.toFixed(2))).toBeInTheDocument();
  expect(group("Personas over baseline").getByText(String(e.over))).toBeInTheDocument();
  expect(
    group("Worst variance").getByText((e.worst > 0 ? "+" : "") + e.worst.toFixed(2)),
  ).toBeInTheDocument();
  expect(group("Still open").getByText(fmt(e.open))).toBeInTheDocument();
  expect(group("Past SLA age").getByText(fmt(e.sla))).toBeInTheDocument();
}

function expectPersonaTable(e: ReturnType<typeof expected>) {
  const body = within(screen.getByRole("table", { name: "Persona ticket health" }))
    .getAllByRole("row")
    .slice(1) as HTMLTableRowElement[];
  expect(body.map((r) => r.cells[0].textContent)).toEqual(e.personaRows.map((r) => r.name));
  body.forEach((row, i) => {
    const r = e.personaRows[i];
    expect(row.cells[4]).toHaveTextContent(fmt(r.n));
    expect(row.cells[5]).toHaveTextContent(r.per.toFixed(2));
    expect(row.cells[6]).toHaveTextContent(r.b.toFixed(2));
    expect(row.cells[7]).toHaveTextContent((r.variance > 0 ? "+" : "") + r.variance.toFixed(2));
    expect(row.cells[8]).toHaveTextContent(r.status);
  });
}

describe("incidents", () => {
  it("KPIs match the wireframe", async () => {
    await openTickets();
    const e = expected("inc");
    expectKpis(e, "incidents");
    expect(group("Resolved or closed").getByText(fmt(e.total - e.open))).toBeInTheDocument();
    expect(group("Top category")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Top category" })).toHaveTextContent(
      `${e.byCat[0].k}${fmt(e.byCat[0].n)} of ${fmt(e.total)}`,
    );
  });

  it("legend and top departments match the wireframe", async () => {
    await openTickets();
    const e = expected("inc");
    const legend = within(screen.getByRole("group", { name: "Ticket distribution legend" })).getAllByRole(
      "button",
    );
    expect(legend.map((b) => b.textContent)).toEqual(
      e.byCat.map((d) => `${d.k}${fmt(d.n)}${((d.n / e.total) * 100).toFixed(1)}%`),
    );
    const depts = screen.getAllByRole("list").find((l) => within(l).queryByText(e.depts[0].k))!;
    expect(
      within(depts)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(e.depts.map((d) => d.k + d.n));
    expect(screen.getByRole("img", { name: "Volume by week" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tickets by age and priority" })).toBeInTheDocument();
  });

  it("persona ticket health table matches the wireframe, worst variance first", async () => {
    await openTickets();
    expectPersonaTable(expected("inc"));
  });
});

describe("service requests", () => {
  it("switching mode shows request numbers, labels and statuses", async () => {
    const { user } = await openTickets();
    await user.click(screen.getByRole("button", { name: "Service requests" }));
    const e = expected("req");
    await waitFor(() => expect(group("Total requests").getByText(fmt(e.total))).toBeInTheDocument());
    expectKpis(e, "requests");
    expect(group("Fulfilled or rejected").getByText(fmt(e.total - e.open))).toBeInTheDocument();
    expect(screen.getByText("Ticket distribution by catalog item")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Top catalog item" })).toHaveTextContent(e.byCat[0].k);
    expect(screen.getByText(/Repeated memory and storage requests/)).toBeInTheDocument();
    expectPersonaTable(e);
  });
});

describe("filters", () => {
  it("persona filter scopes KPIs and the table", async () => {
    const { user } = await openTickets();
    await user.selectOptions(screen.getByLabelText("Persona"), "FIELD");
    const e = expected("inc", "FIELD");
    await waitFor(() => expect(group("Total incidents").getByText(fmt(e.total))).toBeInTheDocument());
    expectKpis(e, "incidents");
    expectPersonaTable(e);
  });

  it("category filter from the legend, with a clear chip", async () => {
    const { user } = await openTickets();
    const first = expected("inc").byCat[1].k;
    await user.click(
      within(screen.getByRole("group", { name: "Ticket distribution legend" })).getByRole("button", {
        name: new RegExp(`^${first}`),
      }),
    );
    const e = expected("inc", "all", first);
    await waitFor(() => expect(group("Total incidents").getByText(fmt(e.total))).toBeInTheDocument());
    expect(group("Per user").getByText(e.per.toFixed(2))).toBeInTheDocument();
    /* The persona table grades the whole set, as in the wireframe. */
    expectPersonaTable(expected("inc"));
    await user.click(screen.getByRole("button", { name: `${first} ✕` }));
    await waitFor(() =>
      expect(group("Total incidents").getByText(fmt(expected("inc").total))).toBeInTheDocument(),
    );
  });

  it("switching mode clears the category filter", async () => {
    const { user } = await openTickets();
    act(() => useUi.getState().set({ ticketCatFilter: "Hardware" }));
    await user.click(screen.getByRole("button", { name: "Service requests" }));
    expect(useUi.getState().ticketCatFilter).toBeNull();
  });
});

describe("ticket ceiling from Baselines", () => {
  it("raising a persona's ceiling re-grades its row and the KPIs", async () => {
    await openTickets();
    const edited = { ...wf.DEFAULT_BASELINE, CC: { ...wf.DEFAULT_BASELINE.CC, ticketsPer100: 40 } };
    act(() => useUi.getState().setBaselineField("CC", wf.DEFAULT_BASELINE.CC, "ticketsPer100", 40));
    const e = expected("inc", "all", null, edited);
    await waitFor(() => expectPersonaTable(e));
    expect(group("Ticket baseline").getByText(e.avgBase.toFixed(2))).toBeInTheDocument();
    expect(group("Personas over baseline").getByText(String(e.over))).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("Investigate and row clicks open the persona page", async () => {
    const { user, router } = await openTickets();
    const worst = expected("inc").personaRows[0];
    await user.click(screen.getAllByRole("link", { name: /Investigate/ })[0]);
    expect(router.state.location.pathname).toBe(`/personas/${worst.id}`);
  });
});
