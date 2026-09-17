/* Quality audit of the production build in Chrome:
   - layout: at phone, tablet and desktop widths, nothing may stick out past the
     window edge (wide tables and charts must scroll inside their own container)
   - accessibility: axe-core rules (WCAG 2.1 A/AA) on every page, in every theme
   Writes screenshots to e2e/audit-output/ and exits non-zero on any failure.

   Usage: npm run build && npm run audit            (local)
          AUDIT_URL=https://… npm run audit          (a deployed site) */
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = 4181;
const external = process.env.AUDIT_URL;
const base = (external ?? `http://localhost:${PORT}`).replace(/\/$/, "");
const OUT = "e2e/audit-output";
const ONLY = process.env.AUDIT_ONLY; // "layout" | "axe"

const PAGES = [
  ["personas", "/personas"],
  ["persona", "/personas/CC"],
  ["device", "/personas/CC/devices/CC-0001"],
  ["baselines", "/baselines/CC"],
  ["tickets", "/tickets"],
  ["change", "/change"],
  ["switch", "/switch"],
];
const WIDTHS = [
  ["phone", 390],
  ["tablet", 768],
  ["desktop", 1440],
];
const THEMES = ["midnight", "carbon", "nord", "ember", "teal", "daylight", "parchment"];

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

/** Elements that stick out past the window, or are cut off by a clipping (overflow: hidden) parent.
    Content inside a scrolling container (overflow-x: auto / scroll) is allowed to be wider. */
const overflowScript = () => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const describe = (el) =>
    `${el.tagName.toLowerCase()} "${(
      el.getAttribute("aria-label") ||
      el.className?.baseVal ||
      el.className ||
      el.textContent ||
      ""
    )
      .toString()
      .trim()
      .slice(0, 50)}"`;
  for (const el of document.querySelectorAll("#root *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).position === "fixed") continue;
    let limitRight = vw;
    let limitLeft = 0;
    let clipper = "window";
    let scrolls = false;
    let foundClipper = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
        /* Anything inside a scroll container may be wider: the reader scrolls to it. */
        scrolls = true;
        break;
      }
      if (!foundClipper && (cs.overflowX === "hidden" || cs.overflowX === "clip")) {
        const pr = p.getBoundingClientRect();
        limitRight = Math.min(limitRight, pr.right);
        limitLeft = Math.max(limitLeft, pr.left);
        clipper = describe(p);
        foundClipper = true;
      }
    }
    if (scrolls) continue;
    /* Text that truncates with an ellipsis is intentional. */
    if (getComputedStyle(el).textOverflow === "ellipsis") continue;
    if (r.right > limitRight + 1 || r.left < limitLeft - 1) {
      out.push(
        `${describe(el)} spans ${Math.round(r.left)}–${Math.round(r.right)}px, cut off by ${clipper} (${Math.round(limitLeft)}–${Math.round(limitRight)}px)`,
      );
    }
  }
  return { problems: out.slice(0, 8), count: out.length };
};

async function openPage(browser, path, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("close", () => context.close().catch(() => {}));
  await page.addInitScript((t) => {
    localStorage.setItem(
      "pfc-ui",
      JSON.stringify({ state: { theme: t, motion: false, chartNames: false }, version: 1 }),
    );
  }, theme);
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 2 }).first().waitFor();
  if (path === "/switch") {
    await page.locator("#swuser").selectOption("CC-0001");
    await page.locator("#swto").selectOption("KW");
    await page.getByRole("table", { name: "Impact of the persona change" }).waitFor();
  }
  await page.waitForTimeout(300);
  return page;
}

const failures = [];

async function layout(browser) {
  for (const [name, path] of PAGES) {
    for (const [device, width] of WIDTHS) {
      const page = await openPage(browser, path, width, "midnight");
      const { problems, count } = await page.evaluate(overflowScript);
      const docOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (count || docOverflow > 1) {
        failures.push(
          `layout ${name} @${device} (${width}px): ${count} element(s) past the edge${docOverflow > 1 ? `, page scrolls sideways by ${docOverflow}px` : ""}`,
        );
        problems.forEach((p) => failures.push(`    ${p}`));
      }
      if (device !== "desktop")
        await page.screenshot({ path: `${OUT}/${name}-${device}.png`, fullPage: true });
      await page.close();
    }
  }
}

async function axe(browser) {
  const summary = new Map();
  for (const theme of THEMES) {
    for (const [name, path] of PAGES) {
      const page = await openPage(browser, path, 1440, theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const v of results.violations) {
        const key = `${v.id}`;
        const entry = summary.get(key) ?? {
          impact: v.impact,
          help: v.help,
          where: new Set(),
          nodes: 0,
          sample: v.nodes[0]?.target?.join(" "),
        };
        entry.where.add(`${name}/${theme}`);
        entry.nodes += v.nodes.length;
        summary.set(key, entry);
      }
      await page.close();
    }
  }
  for (const [id, e] of summary) {
    failures.push(
      `axe ${id} (${e.impact}): ${e.help} — ${e.nodes} node(s) on ${[...e.where].slice(0, 6).join(", ")}${e.where.size > 6 ? ` +${e.where.size - 6} more` : ""}; e.g. ${e.sample}`,
    );
  }
}

try {
  mkdirSync(OUT, { recursive: true });
  if (!external) await startPreview();
  const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER ?? "chrome" });
  if (ONLY !== "axe") await layout(browser);
  if (ONLY !== "layout") await axe(browser);
  await browser.close();
  if (failures.length) {
    console.error("Audit FAILED:");
    failures.forEach((f) => console.error("  - " + f));
    process.exitCode = 1;
  } else {
    const parts = [];
    if (ONLY !== "axe")
      parts.push(
        `${PAGES.length} pages × ${WIDTHS.length} widths with nothing past the window edge or cut off`,
      );
    if (ONLY !== "layout")
      parts.push(`axe WCAG 2.1 AA clean on ${PAGES.length} pages × ${THEMES.length} themes`);
    console.log(`Audit passed: ${parts.join("; ")}.`);
  }
} catch (e) {
  console.error("Audit could not run:", e);
  process.exitCode = 1;
} finally {
  stopPreview();
}
