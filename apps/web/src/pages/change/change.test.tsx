/* Change page (04) and Switch page (05), checked against the wireframe. */
import { switchMetrics } from "@pfc/scoring";
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tally } from "@pfc/contract";
import { loadWireframe } from "../../mocks/data/wireframe.ts";
import { renderApp } from "../../test/renderApp.tsx";

/* eslint-disable @typescript-eslint/no-explicit-any -- wireframe objects are untyped */
const wf = loadWireframe();
const model: any[] = wf.buildModel(wf.DEFAULT_BASELINE);
const fmt = (n: number) => n.toLocaleString();
const group = (name: string) => within(screen.getByRole("group", { name }));
const personaName = (id: string) => wf.PERSONA_DEFS.find((p: any) => p.id === id).name;

describe("switch impact metrics match the wireframe's swMetrics", () => {
  it("for every sample device moving to every other persona (1,092 cases)", () => {
    const ctx = {
      baselines: wf.DEFAULT_BASELINE,
      apps: wf.APPS,
      tasksAutomated: wf.TASKS_AUTO,
      onboardingDays: wf.ONBOARD_DAYS,
    };
    let cases = 0;
    for (const p of wf.RAW) {
      for (const d of p.sample) {
        for (const to of wf.PERSONA_DEFS.map((x: any) => x.id).filter((id: string) => id !== p.id)) {
          expect(switchMetrics(d, p.id, to, ctx), `${d.id} → ${to}`).toEqual(wf.swMetrics(d, p.id, to));
          cases++;
        }
      }
    }
    expect(cases).toBe(1092);
  });
});

describe("change page", () => {
  const open = async () => {
    const utils = renderApp("/change");
    await screen.findByRole("table", { name: "Change by persona" });
    return utils;
  };

  it("KPIs, exception bars and flow match the wireframe", async () => {
    await open();
    expect(group("Persona changes").getByText(String(wf.MIGRATIONS.length))).toBeInTheDocument();
    expect(
      group("People reassigned").getByText(fmt(wf.MIGRATIONS.reduce((a: number, m: any) => a + m.people, 0))),
    ).toBeInTheDocument();
    expect(group("App exceptions").getByText(String(wf.EXCEPTIONS.length))).toBeInTheDocument();
    expect(
      group("Exceptions pending").getByText(
        String(wf.EXCEPTIONS.filter((e: any) => e.state === "Pending").length),
      ),
    ).toBeInTheDocument();
    const top = tally(wf.EXCEPTIONS, (e: any) => e.app).slice(0, 8);
    const list = screen.getAllByRole("list").find((l) => within(l).queryByText(top[0].k))!;
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(top.map((r) => r.k + r.n));
    const flow = screen.getByRole("img", { name: "Where people moved" });
    expect(within(flow).getByText("+244 people")).toBeInTheDocument(); // Data Science: 148 + 96
    expect(within(flow).getByText("−251 people")).toBeInTheDocument(); // Knowledge Worker: 148 + 62 + 41
  });

  it("by-persona table is sorted by movement and matches the wireframe", async () => {
    await open();
    const rows = [...model].sort((a, b) => b.movedIn + b.movedOut - (a.movedIn + a.movedOut));
    const body = within(screen.getByRole("table", { name: "Change by persona" }))
      .getAllByRole("row")
      .slice(1) as HTMLTableRowElement[];
    expect(body.map((r) => r.cells[0].textContent)).toEqual(rows.map((p) => p.name));
    body.forEach((r, i) => {
      const p = rows[i];
      const net = p.movedIn - p.movedOut;
      expect(r.cells[1]).toHaveTextContent(p.movedIn ? "+" + p.movedIn : "—");
      expect(r.cells[2]).toHaveTextContent(p.movedOut ? "−" + p.movedOut : "—");
      expect(r.cells[3]).toHaveTextContent(net > 0 ? "+" + net : net ? String(net) : "—");
      expect(r.cells[4]).toHaveTextContent(String(p.exceptions.length));
      expect(r.cells[5]).toHaveTextContent(p.excPending ? String(p.excPending) : "—");
    });
  });

  it("rows open the persona page", async () => {
    const { user, router } = await open();
    await user.click(within(screen.getByRole("table", { name: "Change by persona" })).getByText("Executive"));
    expect(router.state.location.pathname).toBe("/personas/EXEC");
  });
});

describe("switch page", () => {
  const open = async () => {
    const utils = renderApp("/switch");
    await screen.findByLabelText("Step 1 · Select user");
    return utils;
  };

  it("groups users by persona and starts with nothing selected", async () => {
    await open();
    const select = screen.getByLabelText("Step 1 · Select user");
    expect(
      within(select)
        .getAllByRole("group")
        .map((g) => g.getAttribute("label")),
    ).toEqual(wf.PERSONA_DEFS.map((p: any) => p.name));
    expect(within(select).getAllByRole("option")).toHaveLength(1 + 182);
    expect(screen.queryByLabelText("Step 3 · Choose new persona")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Persona change log" })).not.toBeInTheDocument();
  });

  it("shows the current persona, then the impact of the chosen move", async () => {
    const { user } = await open();
    const d = wf.RAW.find((p: any) => p.id === "CC").sample[0];
    await user.selectOptions(screen.getByLabelText("Step 1 · Select user"), d.id);
    expect(screen.getByRole("group", { name: "Current persona" })).toHaveTextContent("Contact Centre");
    expect(screen.getByLabelText("Step 3 · Choose new persona")).not.toContainHTML('value="CC"');

    await user.selectOptions(screen.getByLabelText("Step 3 · Choose new persona"), "KW");
    const m = wf.swMetrics(d, "CC", "KW");
    expect(
      screen.getByText(`Step 4 · Impact of moving ${d.user} from Contact Centre to Knowledge Worker`),
    ).toBeInTheDocument();
    expect(
      group("Productivity score (of 100)").getByText(`${m.prodBefore} → ${m.prodAfter}`),
    ).toBeInTheDocument();
    const delta = m.tasksAfter - m.tasksBefore;
    expect(group("Tasks automated").getByText(`${delta >= 0 ? "+" : ""}${delta} / wk`)).toBeInTheDocument();
    expect(group("Security risk").getByText(`${m.riskBefore} → ${m.riskAfter}`)).toBeInTheDocument();
    expect(group("User experience score").getByText(`${m.uxBefore} → ${m.uxAfter}`)).toBeInTheDocument();

    const table = within(screen.getByRole("table", { name: "Impact of the persona change" }));
    const row = (label: string) => table.getByText(label).closest("tr")!;
    expect(row("Productivity score")).toHaveTextContent(`${m.prodBefore}${m.prodAfter}`);
    expect(row("Tasks automated per week")).toHaveTextContent(`${m.tasksBefore}${m.tasksAfter}`);
    expect(row("Apps added")).toHaveTextContent(m.add.join(", "));
    expect(row("Apps removed")).toHaveTextContent(m.rem.join(", "));
    expect(row("Apps to install on this device")).toHaveTextContent(String(m.need.length));
    expect(row("RAM")).toHaveTextContent(`${m.ramBefore}GB${m.ramAfter}GB`);
    expect(row("Boot time")).toHaveTextContent(`${m.bootBefore}s${m.bootAfter}s`);
    expect(row("Support tickets per user")).toHaveTextContent(`${m.tixBefore}${m.tixAfter}`);
    expect(row("Onboarding time (days)")).toHaveTextContent(`${m.onBefore}${m.onAfter}`);
  });

  it("colours better and worse outcomes", async () => {
    const { user } = await open();
    const d = wf.RAW.find((p: any) => p.id === "DEV").sample[0];
    await user.selectOptions(screen.getByLabelText("Step 1 · Select user"), d.id);
    await user.selectOptions(screen.getByLabelText("Step 3 · Choose new persona"), "KW");
    const table = within(screen.getByRole("table", { name: "Impact of the persona change" }));
    /* Engineering automates 14 tasks, Knowledge Worker 8: worse, shown red. */
    expect(table.getByText("Tasks automated per week").closest("tr")!.cells[2]).toHaveStyle({
      color: "var(--bad)",
    });
    /* Onboarding 3 days → 1 day: better, shown green. */
    expect(table.getByText("Onboarding time (days)").closest("tr")!.cells[2]).toHaveStyle({
      color: "var(--good)",
    });
  });

  it("applies a change: toast, log, and every page reflects the move", async () => {
    const { user, router } = await open();
    const d = wf.RAW.find((p: any) => p.id === "KW").sample[0];
    await user.selectOptions(screen.getByLabelText("Step 1 · Select user"), d.id);
    await user.selectOptions(screen.getByLabelText("Step 3 · Choose new persona"), "DS");
    await user.click(screen.getByRole("button", { name: "Apply persona change" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      `Persona changed: ${d.user} moved from Knowledge Worker to Data Science. Personas, Change and persona pages are updated.`,
    );
    const log = within(await screen.findByRole("table", { name: "Persona change log" }));
    expect(log.getAllByRole("row")[1]).toHaveTextContent(`${d.user}Knowledge WorkerData Science`);
    /* The user now belongs to Data Science and the impact step closes. */
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Current persona" })).toHaveTextContent("Data Science"),
    );
    expect(screen.queryByRole("table", { name: "Impact of the persona change" })).not.toBeInTheDocument();

    await act(() => router.navigate("/change"));
    await waitFor(() => expect(group("People reassigned").getByText("469")).toBeInTheDocument());

    await act(() => router.navigate("/personas/DS"));
    await waitFor(() => expect(group("Devices").getByText("341")).toBeInTheDocument());
    expect(within(screen.getByRole("table", { name: "Devices" })).getByText(d.host)).toBeInTheDocument();

    await act(() => router.navigate("/personas/KW"));
    await waitFor(() => expect(group("Devices").getByText("6,119")).toBeInTheDocument());
  });

  it("Start again clears the selection", async () => {
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText("Step 1 · Select user"), wf.RAW[0].sample[1].id);
    await user.selectOptions(screen.getByLabelText("Step 3 · Choose new persona"), "EXEC");
    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(screen.getByLabelText("Step 1 · Select user")).toHaveValue("");
    expect(screen.queryByLabelText("Step 3 · Choose new persona")).not.toBeInTheDocument();
  });

  it("log links go to the new persona and the Change page", async () => {
    const { user, router } = await open();
    const d = wf.RAW.find((p: any) => p.id === "EXEC").sample[2];
    await user.selectOptions(screen.getByLabelText("Step 1 · Select user"), d.id);
    await user.selectOptions(screen.getByLabelText("Step 3 · Choose new persona"), "CRE");
    await user.click(screen.getByRole("button", { name: "Apply persona change" }));
    const link = await screen.findByRole("link", { name: `${personaName("CRE")} page` });
    await user.click(link);
    expect(router.state.location.pathname).toBe("/personas/CRE");
  });
});
