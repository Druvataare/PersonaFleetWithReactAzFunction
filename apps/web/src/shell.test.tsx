import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUi } from "./store/ui.ts";
import { renderApp } from "./test/renderApp.tsx";

const kpi = (label: string) => within(screen.getByRole("group", { name: label }));

describe("routing", () => {
  it("redirects / to /personas", async () => {
    const { router } = renderApp("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/personas"));
    expect(await screen.findByRole("heading", { name: "Personas" })).toBeInTheDocument();
  });

  it.each([
    ["/personas", "Personas"],
    ["/baselines", "Baselines & device fit"],
    ["/tickets", "Tickets"],
    ["/change", "Change"],
    ["/switch", "Persona change"],
  ])("opens %s directly", async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
  });

  it("opens a persona page from a deep link", async () => {
    renderApp("/personas/CC");
    expect(await screen.findByRole("heading", { name: "Contact Centre" })).toBeInTheDocument();
    expect(kpi("Devices").getByText("2,450")).toBeInTheDocument();
  });

  it("opens a device page from a deep link", async () => {
    renderApp("/personas/DEV/devices/DEV-0001");
    expect(await screen.findByText("Device health")).toBeInTheDocument();
    expect(screen.getByText(/@contoso\.com/)).toBeInTheDocument();
  });

  it("opens a persona's baseline from a deep link", async () => {
    renderApp("/baselines/DS");
    expect(await screen.findByText("Baseline contract · Data Science")).toBeInTheDocument();
    expect(screen.getByText(/64GB RAM · 2TB storage/)).toBeInTheDocument();
  });

  it.each([
    ["/nowhere", "This page does not exist"],
    ["/personas/NOPE", 'Persona "NOPE" does not exist'],
    ["/personas/DEV/devices/NOPE", 'Device "NOPE" does not exist'],
  ])("shows not found for %s", async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });
});

describe("top bar", () => {
  it("navigates with every nav item and marks the active one", async () => {
    const { user, router } = renderApp("/personas");
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const [label, path] of [
      ["Baselines", "/baselines"],
      ["Tickets", "/tickets"],
      ["Change", "/change"],
      ["Switch", "/switch"],
      ["Personas", "/personas"],
    ]) {
      await user.click(within(nav).getByRole("link", { name: label }));
      expect(router.state.location.pathname).toBe(path);
      expect(within(nav).getByRole("link", { name: label })).toHaveClass("on");
    }
  });

  it("keeps Personas active on persona and device pages", async () => {
    renderApp("/personas/DEV/devices/DEV-0001");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Personas" })).toHaveClass("on");
  });

  it("switches between all seven themes", async () => {
    const { user } = renderApp("/personas");
    const select = screen.getByLabelText("Theme");
    expect(within(select).getAllByRole("option")).toHaveLength(7);
    await user.selectOptions(select, "daylight");
    expect(useUi.getState().theme).toBe("daylight");
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#F5F6FA"));
    await user.selectOptions(select, "ember");
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#E0A458"));
  });

  it("toggles MOTION and CHART NAMES on the body", async () => {
    const { user } = renderApp("/personas");
    const motion = screen.getByRole("button", { name: "MOTION" });
    const names = screen.getByRole("button", { name: "CHART NAMES" });
    await user.click(motion);
    expect(motion).toHaveAttribute("aria-pressed", "true");
    expect(document.body).toHaveClass("motion");
    await user.click(names);
    expect(document.body).toHaveClass("types");
    await user.click(names);
    expect(document.body).not.toHaveClass("types");
  });

  it("shows the tour button as not yet available and flags demo data", () => {
    renderApp("/personas");
    expect(screen.getByRole("button", { name: /TOUR/ })).toBeDisabled();
    expect(screen.getByText("DEMO DATA")).toBeInTheDocument();
  });
});

describe("breadcrumbs and back", () => {
  const crumbs = () => within(screen.getByRole("navigation", { name: "Breadcrumb" }));

  it("has no back button on the landing page", async () => {
    renderApp("/personas");
    await screen.findByRole("heading", { name: "Personas" });
    expect(crumbs().queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(crumbs().getByText("Personas")).toHaveAttribute("aria-current", "page");
  });

  it("shows Personas › persona › host on a device page, with working links", async () => {
    const { user, router } = renderApp("/personas/DEV/devices/DEV-0001");
    const host = await crumbs().findByText(/^DEV-WKS-\d{4}$/);
    expect(host).toHaveAttribute("aria-current", "page");
    await user.click(await crumbs().findByRole("link", { name: "Engineering" }));
    expect(router.state.location.pathname).toBe("/personas/DEV");
    await user.click(crumbs().getByRole("link", { name: "Personas" }));
    expect(router.state.location.pathname).toBe("/personas");
  });

  it.each([
    ["/tickets", "Tickets"],
    ["/change", "Change"],
    ["/baselines/DEV", "Baselines"],
    ["/switch", "Persona change"],
  ])("labels the section on %s", async (path, label) => {
    renderApp(path);
    expect(crumbs().getByText(label)).toHaveAttribute("aria-current", "page");
  });

  it("goes from device to persona to landing with the back button", async () => {
    const { user, router } = renderApp("/personas/KW/devices/KW-0003");
    await user.click(crumbs().getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/personas/KW");
    await user.click(crumbs().getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/personas");
  });
});

describe("pages use live mock data", () => {
  it("shows the wireframe's headline numbers on Personas", async () => {
    renderApp("/personas");
    await screen.findByRole("group", { name: "Personas" });
    expect(kpi("Personas").getByText("7")).toBeInTheDocument();
    expect(kpi("Devices in estate").getByText("12,095")).toBeInTheDocument();
  });

  it("filters to personas below 85 health when Needs attention is on", async () => {
    const { user } = renderApp("/personas");
    const grid = await screen.findByLabelText("Persona cards");
    expect(within(grid).getAllByRole("link")).toHaveLength(7);
    // Relax Executive's contract so it becomes healthy and drops out of the filter.
    const easy = {
      ramGB: 8,
      storageGB: 256,
      cpuScore: 30,
      bootSec: 120,
      crashes: 10,
      freePct: 5,
      batteryPct: 40,
      ticketsPer100: 40,
    };
    act(() => useUi.setState({ draftBaselines: { EXEC: easy } }));
    await user.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(screen.getByRole("button", { name: "Needs attention" })).toHaveAttribute("aria-pressed", "true");
    const shown = within(grid).getAllByRole("link");
    shown.forEach((card) => {
      const health = Number(card.querySelector(".ring-meta .m")?.textContent);
      expect(health).toBeLessThan(85);
    });
    expect(within(grid).queryByRole("link", { name: /Executive/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All personas" }));
    expect(within(grid).getAllByRole("link")).toHaveLength(7);
  });

  it("opens a persona from the grid and a device from its table", async () => {
    const { user, router } = renderApp("/personas");
    const grid = await screen.findByLabelText("Persona cards");
    await user.click(within(grid).getByRole("link", { name: /Field Engineer/ }));
    expect(router.state.location.pathname).toBe("/personas/FIELD");
    const table = await screen.findByRole("table");
    await user.click(within(table).getAllByRole("link")[0]);
    expect(router.state.location.pathname).toMatch(/^\/personas\/FIELD\/devices\/FIELD-\d{4}$/);
  });

  it("switches Tickets between incidents and requests", async () => {
    const { user } = renderApp("/tickets");
    expect(await kpiAsync("Total incidents", "2,063")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Service requests" }));
    expect(await kpiAsync("Total requests", "1,438")).toBeInTheDocument();
  });

  it("shows change counts", async () => {
    renderApp("/change");
    expect(await kpiAsync("People reassigned", "468")).toBeInTheDocument();
    expect(kpi("Exceptions pending").getByText("15")).toBeInTheDocument();
  });
});

async function kpiAsync(label: string, value: string) {
  const group = await screen.findByRole("group", { name: label });
  return within(group).findByText(value);
}

describe("chart library page", () => {
  it("renders every chart on live mock data and switches persona", async () => {
    const { user } = renderApp("/dev/charts");
    expect(await screen.findByRole("img", { name: "Contact Centre health" })).toBeInTheDocument();
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
      "Volume by week",
      "Where people moved",
      "Fit distribution by persona",
      "devices",
      "titles",
    ]) {
      expect(screen.getAllByRole("img", { name }).length, name).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole("img", { name: "tickets" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "DS" }));
    expect(screen.getByText("Five pillars · Data Science")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connectivity: 374" }));
    expect(screen.getByRole("button", { name: "Connectivity: 374" })).toHaveAttribute("aria-pressed", "true");
  });
});
