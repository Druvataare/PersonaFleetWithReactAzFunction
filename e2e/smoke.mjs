/* Production smoke test. Serves the minified build (vite preview) and clicks
   through the app in real Chrome, failing on any page error or console error.
   Catches problems that only appear after minification, which unit tests
   (run against the development build) cannot see.

   Usage: npm run build && npm run smoke            (local Chrome)
          SMOKE_URL=https://… npm run smoke          (an already deployed site) */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = 4173;
const external = process.env.SMOKE_URL;
const base = (external ?? `http://localhost:${PORT}`).replace(/\/$/, "");
const errors = [];
let server;

async function startPreview() {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: "apps/web",
    shell: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("vite preview did not start");
}

function stopPreview() {
  if (!server) return;
  if (process.platform === "win32")
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

async function run() {
  if (!external) await startPreview();
  const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER ?? "chrome" });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console error: ${m.text().split("\n")[0]}`);
  });

  const steps = [];
  const step = async (label, action, expectHeading) => {
    try {
      await action();
    } catch (e) {
      errors.push(`${label}: ${e.message.split("\n")[0]}`);
      steps.push(label);
      return;
    }
    await page.waitForTimeout(400);
    if (await page.getByText("Something went wrong").count()) {
      const why = await page.locator(".pagehead .sub").first().textContent();
      errors.push(`${label}: error page shown (${why})`);
    }
    if (expectHeading) {
      const found = await page
        .getByRole("heading", { name: expectHeading })
        .first()
        .isVisible()
        .catch(() => false);
      if (!found) errors.push(`${label}: heading "${expectHeading}" not visible at ${page.url()}`);
    }
    steps.push(label);
  };
  const click = (role, name) => () => page.getByRole(role, { name }).first().click();

  await step("open Personas", () => page.goto(`${base}/personas`, { waitUntil: "networkidle" }), "Personas");
  await step("page content keeps a side margin", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const left = await page
      .locator("#app .statbox")
      .first()
      .evaluate((el) => el.getBoundingClientRect().left);
    if (left < 16) throw new Error(`KPI tile starts ${left}px from the window edge`);
  });
  for (const theme of ["daylight", "ember", "midnight"]) {
    await step(`theme ${theme}`, () => page.selectOption("#themesel", theme));
  }
  await step("toggle MOTION off and on", async () => {
    await page.getByRole("button", { name: "MOTION" }).click();
    await page.getByRole("button", { name: "MOTION" }).click();
  });
  await step("toggle CHART NAMES", click("button", "CHART NAMES"));
  await step("confidence band filter", click("button", /Confidence <50%/));
  await step("clear band filter", click("button", "Clear band filter ✕"));
  await step("mapping persona selector", () => page.selectOption("#cpsel", "CC"));
  await step("mapping donut slice by keyboard", async () => {
    await page.getByRole("button", { name: /^CC: / }).first().focus();
    await page.keyboard.press("Enter");
    const value = await page.locator("#cpsel").inputValue();
    if (value !== "all")
      throw new Error(`Enter on the selected slice should clear the persona filter, got ${value}`);
  });
  await step("review queue search", () => page.fill("#csearch", "legal"));
  await step("clear search", () => page.fill("#csearch", ""));
  await step("Needs attention filter", click("button", "Needs attention"));
  await step("All personas filter", click("button", "All personas"));
  await step("open Engineering", click("link", /Engineering/), "Engineering");
  await step("persona ticket mix filter", () =>
    page.getByRole("group", { name: "Ticket mix legend" }).getByRole("button").first().click(),
  );
  await step("clear ticket mix filter", click("button", "Clear"));
  await step("persona device search", () => page.fill("#devsearch", "a"));
  await step("open a device", () => page.locator('table[aria-label="Devices"] tbody tr').first().click());
  await step("raise provisioning request", async () => {
    await page.getByRole("button", { name: "Raise provisioning request" }).click();
    await page.getByRole("status").filter({ hasText: "routed to EUC-Provisioning" }).waitFor();
  });
  await step("back to persona", click("button", "Back"), "Engineering");
  await step("back to Personas", click("button", "Back"), "Personas");
  await step("nav Baselines", click("link", "Baselines"), "Baselines & device fit");
  await step("pick Data Science baseline", click("button", "Data Science"));
  await step("move baseline sliders", async () => {
    await page.locator("#slider-ramGB").fill("128");
    await page.locator("#slider-ticketsPer100").fill("30");
    await page.getByText("UNSAVED CHANGES").waitFor();
  });
  await step("reset baseline", async () => {
    await page.getByRole("button", { name: "Reset Data Science" }).click();
    if (await page.getByText("UNSAVED CHANGES").count()) throw new Error("reset did not clear the edit");
  });
  await step("pick persona from heat table", () =>
    page.getByRole("table", { name: "Component match" }).getByText("Contact Centre").click(),
  );
  await step("nav Tickets", click("link", "Tickets"), "Tickets");
  await step("tickets persona filter", () => page.selectOption("#tpsel", "CC"));
  await step("tickets category filter", () =>
    page.getByRole("group", { name: "Ticket distribution legend" }).getByRole("button").first().click(),
  );
  await step("clear tickets category", () => page.getByRole("button", { name: /✕$/ }).click());
  await step("tickets persona all", () => page.selectOption("#tpsel", "all"));
  await step("service requests", click("button", "Service requests"));
  await step("investigate a persona", async () => {
    await page
      .getByRole("link", { name: /Investigate/ })
      .first()
      .click();
    await page.getByRole("table", { name: "Devices" }).waitFor();
    await page.goBack();
  });
  await step("nav Change", click("link", "Change"), "Change");
  await step("open a persona from the Change table", async () => {
    await page.getByRole("table", { name: "Change by persona" }).getByText("Data Science").click();
    await page.getByRole("table", { name: "Devices" }).waitFor();
    await page.goBack();
  });
  await step("nav Switch", click("link", "Switch"), "Persona change");
  await step("switch: pick user and persona", async () => {
    await page.locator("#swuser").selectOption({ index: 1 });
    await page.locator("#swto").selectOption({ index: 1 });
    await page.getByRole("table", { name: "Impact of the persona change" }).waitFor();
  });
  await step("switch: apply", async () => {
    await page.getByRole("button", { name: "Apply persona change" }).click();
    await page.getByRole("status").filter({ hasText: "Persona changed" }).waitFor();
    await page.getByRole("table", { name: "Persona change log" }).waitFor();
  });
  await step("switch: see it on the Change page", async () => {
    await page.getByRole("link", { name: "Change page" }).first().click();
    await page.getByRole("heading", { name: "Change" }).waitFor();
  });
  await step(
    "chart library",
    () => page.goto(`${base}/dev/charts`, { waitUntil: "networkidle" }),
    "Chart library",
  );
  await step("switch chart persona", click("button", "DS"));
  await step("replay charts", click("button", "Replay"));
  await step("select a donut slice", () => page.locator('path[role="button"]').first().click());
  await step("deep link device + reload", async () => {
    await page.goto(`${base}/personas/CC/devices/CC-0001`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
  });
  await step(
    "unknown URL",
    () => page.goto(`${base}/nowhere`, { waitUntil: "networkidle" }),
    "This page does not exist",
  );

  await browser.close();
  return steps;
}

try {
  const steps = await run();
  if (errors.length) {
    console.error(`Smoke test FAILED (${errors.length} problem${errors.length > 1 ? "s" : ""}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  } else {
    console.log(`Smoke test passed: ${steps.length} steps against ${base} with no browser errors.`);
  }
} catch (e) {
  console.error("Smoke test could not run:", e);
  process.exitCode = 1;
} finally {
  stopPreview();
}
