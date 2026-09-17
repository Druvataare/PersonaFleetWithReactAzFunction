/* Persona page and Device page, checked against the wireframe's own data. */
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tally } from "../../lib/aggregate.ts";
import { loadWireframe } from "../../mocks/data/wireframe.ts";
import { useUi } from "../../store/ui.ts";
import { renderApp } from "../../test/renderApp.tsx";

/* eslint-disable @typescript-eslint/no-explicit-any -- wireframe objects are untyped */
const wf = loadWireframe();
const model: any[] = wf.buildModel(wf.DEFAULT_BASELINE);
const persona = (id: string) => model.find((p) => p.id === id);
const fmt = (n: number) => n.toLocaleString();
const group = (name: string) => within(screen.getByRole("group", { name }));

const openPersona = async (id: string) => {
  const utils = renderApp(`/personas/${id}`);
  await screen.findByRole("table", { name: "Devices" });
  return utils;
};
const deviceRows = () =>
  within(screen.getByRole("table", { name: "Devices" }))
    .getAllByRole("row")
    .slice(1) as HTMLTableRowElement[];

describe("persona page", () => {
  it.each(["DEV", "CC", "EXEC"])("%s: identity band and eight KPIs match the wireframe", async (id) => {
    await openPersona(id);
    const p = persona(id);
    expect(screen.getByRole("heading", { level: 2, name: p.name })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `${p.name} health ring` })).toBeInTheDocument();
    const net = p.movedIn - p.movedOut;
    const expected: [string, string][] = [
      ["Devices", fmt(p.count)],
      ["Below baseline", fmt(p.underCount)],
      ["Open tickets", fmt(p.openTickets)],
      ["Tickets / 100", p.ticketsPer100.toFixed(1)],
      ["Average boot", Math.round(p.avgBoot) + "s"],
      ["Patch compliant", Math.round(p.patchPct) + "%"],
      ["App exceptions", String(p.exceptions.length)],
      ["Net people moved", (p.movedIn > 0 && net >= 0 ? "+" : "") + net],
    ];
    for (const [label, value] of expected) expect(group(label).getByText(value), label).toBeInTheDocument();
  });

  it("pillar rows show score and weight for each pillar", async () => {
    await openPersona("FIELD");
    const p = persona("FIELD");
    const rows = within(screen.getByRole("list", { name: "Pillar scores" })).getAllByRole("listitem");
    const keys = ["prov", "perf", "comp", "exp", "sup"];
    rows.forEach((row, i) => {
      expect(row).toHaveTextContent(`${Math.round(p.pillars[keys[i]])}w${p.weights[keys[i]]}`);
    });
  });

  it("draws every chart section", async () => {
    await openPersona("DS");
    for (const name of [
      "Health pillars",
      "Health trend, 12 weeks",
      "DEVICE HEALTH SCORE",
      "RAM (GB)",
      "DISK (GB)",
      "CPU BENCHMARK INDEX",
      "Boot time against free disk",
      "Patch compliance by location",
      "Tickets by age and priority",
    ]) {
      expect(screen.getByRole("img", { name }), name).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Ticket mix" })).toBeInTheDocument();
    for (const s of [
      "Health composition",
      "Provisioning against baseline",
      "Experience and compliance",
      "Support load from ServiceNow",
      "Movement and app exceptions",
    ]) {
      expect(screen.getByText(s)).toBeInTheDocument();
    }
  });

  it("links Memory to this persona's baseline", async () => {
    const { user, router } = await openPersona("KW");
    const change = screen
      .getAllByRole("link", { name: "Change" })
      .find((l) => l.getAttribute("href") === "/baselines/KW")!;
    await user.click(change);
    expect(router.state.location.pathname).toBe("/baselines/KW");
  });

  it("ticket mix legend matches the sample tickets", async () => {
    await openPersona("CC");
    const tickets = persona("CC").devices.flatMap((d: any) => d.tickets);
    const legend = group("Ticket mix legend");
    ["Performance", "Hardware", "Application", "Access", "Connectivity", "Provisioning"].forEach((cat) => {
      const n = tickets.filter((t: any) => t.cat === cat).length;
      if (n) expect(legend.getByRole("button", { name: new RegExp(`^${cat}\\s*${n}$`) })).toBeInTheDocument();
    });
  });

  it("support load lists top reported issues and estate mix", async () => {
    await openPersona("DEV");
    const p = persona("DEV");
    const top = tally(
      p.devices.flatMap((d: any) => d.tickets),
      (t: any) => t.short,
    ).slice(0, 6);
    const lists = screen.getAllByRole("list").filter((l) => l.getAttribute("aria-label") === null);
    const reported = lists.find((l) => within(l).queryByText(top[0].k))!;
    expect(
      within(reported)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(top.map((r) => r.k + r.n));
    const models = tally(p.devices, (d: any) => d.model);
    models.forEach((m) => expect(screen.getAllByTitle(m.k).length).toBeGreaterThan(0));
  });

  it("movement cards show people in and out with removed and installed apps", async () => {
    await openPersona("DS");
    const fromKw = group("From Knowledge Worker");
    expect(fromKw.getByText("+148")).toBeInTheDocument();
    const kw = wf.APPS.KW;
    const ds = wf.APPS.DS;
    kw.filter((a) => !ds.includes(a)).forEach((a) =>
      expect(fromKw.getAllByText(a).length).toBeGreaterThan(0),
    );
    ds.filter((a) => !kw.includes(a)).forEach((a) =>
      expect(fromKw.getAllByText(a).length).toBeGreaterThan(0),
    );
    expect(group("From Engineering").getByText("+96")).toBeInTheDocument();
  });

  it("shows a message when nobody moved", async () => {
    await openPersona("EXEC");
    expect(screen.getByText("Nobody moved in or out of this persona this quarter.")).toBeInTheDocument();
  });

  it("lists exception holders pending first, ten at most, with a remainder", async () => {
    await openPersona("KW");
    const p = persona("KW");
    const items = within(screen.getByRole("list", { name: "Exception holders" })).getAllByRole("listitem");
    expect(items).toHaveLength(Math.min(10, p.exceptions.length));
    const pending = p.exceptions.filter((e: any) => e.state === "Pending").length;
    items.slice(0, pending).forEach((li) => expect(li).toHaveTextContent("Pending"));
    expect(screen.getByText(`+ ${p.exceptions.length - 10} more`)).toBeInTheDocument();
    expect(screen.getByText(`${pending} pending`)).toBeInTheDocument();
  });

  it("device table lists every sample device worst first", async () => {
    await openPersona("CC");
    const p = persona("CC");
    const worst = [...p.devices].sort((a: any, b: any) => a.score - b.score);
    expect(deviceRows()).toHaveLength(p.devices.length);
    expect(deviceRows().map((r) => r.cells[0].textContent)).toEqual(worst.map((d: any) => d.host));
    expect(deviceRows()[0].cells[7]).toHaveTextContent(String(Math.round(worst[0].score)));
  });

  it("filters devices by ticket category from the donut legend, and clears", async () => {
    const { user } = await openPersona("CC");
    const p = persona("CC");
    await user.click(group("Ticket mix legend").getAllByRole("button")[0]);
    const cat = useUi.getState().ticketCategory!;
    const expected = p.devices.filter((d: any) => d.tickets.some((t: any) => t.cat === cat)).length;
    expect(deviceRows()).toHaveLength(expected);
    expect(screen.getByText(`Devices · filtered by ${cat} tickets`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(deviceRows()).toHaveLength(p.devices.length);
  });

  it("searches devices by user, host, model or site, with an empty state", async () => {
    const { user } = await openPersona("FIELD");
    const p = persona("FIELD");
    const box = screen.getByLabelText("Search user, host, model or site");
    await user.type(box, "rugged");
    const expected = p.devices.filter((d: any) =>
      (d.user + d.host + d.model + d.site).toLowerCase().includes("rugged"),
    );
    expect(deviceRows()).toHaveLength(expected.length);
    await user.clear(box);
    await user.type(box, "nobody-here");
    expect(screen.getByText("No devices match. Clear the filter or search.")).toBeInTheDocument();
  });

  it("keeps filters for the same persona but not for another", async () => {
    const { user, router } = await openPersona("CC");
    await user.type(screen.getByLabelText("Search user, host, model or site"), "pune");
    await user.click(deviceRows()[0]);
    await screen.findByText("Device health");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Search user, host, model or site")).toHaveValue("pune"),
    );
    await router.navigate("/personas/DEV");
    await waitFor(() => expect(screen.getByLabelText("Search user, host, model or site")).toHaveValue(""));
  });

  it("clicking a row opens the device page", async () => {
    const { user, router } = await openPersona("DEV");
    const host = deviceRows()[2].cells[0].textContent;
    await user.click(deviceRows()[2]);
    const d = persona("DEV").devices.find((x: any) => x.host === host);
    expect(router.state.location.pathname).toBe(`/personas/DEV/devices/${d.id}`);
  });
});

describe("device page", () => {
  const openDevice = async (pid: string, did: string) => {
    const utils = renderApp(`/personas/${pid}/devices/${did}`);
    await screen.findByText("Device health");
    return utils;
  };

  it("shows user, identity and device health", async () => {
    const d = persona("CC").devices[4];
    await openDevice("CC", d.id);
    expect(screen.getByRole("heading", { level: 2, name: d.user })).toBeInTheDocument();
    expect(screen.getByText(`${d.email} · ${d.site}`)).toBeInTheDocument();
    expect(
      screen.getByText(`${d.host} · ${d.model} · ${d.osBuild} · seen ${d.lastSeen}d ago`),
    ).toBeInTheDocument();
    expect(screen.getByText(String(Math.round(d.score)))).toBeInTheDocument();
  });

  it("draws seven bullet charts with actual and target", async () => {
    const p = persona("DS");
    const d = p.devices[0];
    const b = p.baseline;
    await openDevice("DS", d.id);
    const expected: [string, string][] = [
      ["Memory", `${d.ramGB}GB / ${b.ramGB}GB`],
      ["Storage", `${d.storageGB}GB / ${b.storageGB}GB`],
      ["CPU index", `${d.cpuScore} / ${b.cpuScore}`],
      ["Free disk", `${d.freePct}% / ${b.freePct}%`],
      ["Boot time", `${d.bootSec}s / ${b.bootSec}s`],
      ["Battery health", `${d.batteryPct}% / ${b.batteryPct}%`],
      ["Crashes / 30d", `${d.crashes} / ${b.crashes}`],
    ];
    for (const [label, text] of expected) {
      expect(screen.getByRole("group", { name: label }).textContent?.replace(/\s+/g, " ")).toContain(text);
    }
  });

  it("splits apps into entitled, missing and outside the catalogue", async () => {
    const d = persona("KW").devices.find((x: any) =>
      x.installed.some((a: string) => !wf.APPS.KW.includes(a)),
    );
    await openDevice("KW", d.id);
    const catalogue = wf.APPS.KW;
    const texts = (name: string) =>
      within(screen.getByRole("group", { name }))
        .queryAllByText(/./)
        .map((e) => e.textContent);
    d.installed
      .filter((a: string) => catalogue.includes(a))
      .forEach((a: string) => expect(texts("Entitled & installed")).toContain(a));
    catalogue
      .filter((a: string) => !d.installed.includes(a))
      .forEach((a: string) => expect(texts("Missing from device")).toContain(a));
    d.installed
      .filter((a: string) => !catalogue.includes(a))
      .forEach((a: string) => expect(texts("Outside persona")).toContain(a));
  });

  it("lists this device's tickets or says there are none", async () => {
    const withTickets = persona("FIELD").devices.find((x: any) => x.tickets.length > 1);
    await openDevice("FIELD", withTickets.id);
    const items = within(screen.getByRole("list", { name: "Tickets for this device" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(withTickets.tickets.length);
    expect(items[0]).toHaveTextContent(withTickets.tickets[0].number);
    expect(items[0]).toHaveTextContent(
      `${withTickets.tickets[0].cat} · ${withTickets.tickets[0].state} · ${withTickets.tickets[0].group}`,
    );
  });

  it("shows no-ticket message for a device without tickets", async () => {
    const quiet = persona("DEV").devices.find((x: any) => x.tickets.length === 0);
    await openDevice("DEV", quiet.id);
    expect(screen.getByText("No tickets in the last 90 days.")).toBeInTheDocument();
  });

  it("raises a provisioning request and shows the ticket number", async () => {
    const { user } = await openDevice("CC", "CC-0002");
    await user.click(screen.getByRole("button", { name: "Raise provisioning request" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      /^INC005\d{4} created and routed to EUC-Provisioning\.$/,
    );
  });

  it("does not carry a raised request over to another device", async () => {
    const { user, router } = await openDevice("CC", "CC-0002");
    await user.click(screen.getByRole("button", { name: "Raise provisioning request" }));
    await screen.findByRole("status");
    await router.navigate("/personas/CC/devices/CC-0003");
    expect(
      (await screen.findAllByText(persona("CC").devices[2].host, { exact: false })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
