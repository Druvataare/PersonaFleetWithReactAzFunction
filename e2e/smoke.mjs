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
  await step("Needs attention filter", click("button", "Needs attention"));
  await step("All personas filter", click("button", "All personas"));
  await step("open Engineering", click("link", /Engineering/), "Engineering");
  await step("open a device", () => page.locator("table a").first().click(), undefined);
  await step("back to persona", click("button", "Back"), "Engineering");
  await step("back to Personas", click("button", "Back"), "Personas");
  await step("nav Baselines", click("link", "Baselines"), "Baselines & device fit");
  await step("pick Data Science baseline", click("link", "Data Science"));
  await step("nav Tickets", click("link", "Tickets"), "Tickets");
  await step("service requests", click("button", "Service requests"));
  await step("nav Change", click("link", "Change"), "Change");
  await step("nav Switch", click("link", "Switch"), "Persona change");
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
