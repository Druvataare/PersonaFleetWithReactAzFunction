# Persona Fleet Command — Frontend build plan

Building the React front end from the `personalfleet.html` wireframe, using the wireframe's sample data served through a mock API. The plan has 12 steps. Each step ends with a test checkpoint, and the next step starts only after that step is approved.

**Target stack:** React 19 · TypeScript · Vite · React Router · TanStack Query · Zustand · D3 · MSW (mock API) · Vitest · Playwright · Azure Static Web Apps

**Repository:** [Druvataare/PersonaFleetWithReactAzFunction](https://github.com/Druvataare/PersonaFleetWithReactAzFunction) (branch `main`, one commit per step)

**Live site:** https://agreeable-coast-025d2f100.2.azurestaticapps.net (every push to `main` deploys; pull requests get a preview URL)

**Related documents:** [Persona-Fleet-Command-Architecture.html](Persona-Fleet-Command-Architecture.html) · [Persona-Fleet-Command-Architecture.docx](Persona-Fleet-Command-Architecture.docx)

---

## Progress

| #   | Step                       | Status      | Date approved |
| --- | -------------------------- | ----------- | ------------- |
| 1   | Project scaffold           | Done        | 17 Sep 2026   |
| 2   | Scoring package            | Not started |               |
| 3   | Sample data + mock API     | Not started |               |
| 4   | App shell                  | Not started |               |
| 5   | Chart library              | Not started |               |
| 6   | Personas page              | Not started |               |
| 7   | Persona page + Device page | Not started |               |
| 8   | Baselines page             | Not started |               |
| 9   | Tickets page               | Not started |               |
| 10  | Change page + Switch page  | Not started |               |
| 11  | Guided tour                | Not started |               |
| 12  | Quality pass + deploy      | Not started |               |

Status values: `Not started` · `In progress` · `Testing` · `Done`

---

## Step 1 — Project scaffold

**Goal:** a working, empty project that builds, lints and tests.

**What we do**

- Create an npm workspaces repository with:
  - `apps/web`: React 19 + Vite + TypeScript (strict)
  - `packages/scoring`: shared TypeScript package (filled in step 2)
- Add ESLint, Prettier, Vitest, and a shared `tsconfig.base.json`.
- Add `apps/web/public/staticwebapp.config.json` (fallback to `index.html` for client-side routes).
- Run `git init` and add `.gitignore`.

**Test checkpoint**

- `npm run dev` opens a blank app in the browser.
- `npm run build`, `npm run lint` and `npm test` all pass.

---

## Step 2 — Scoring package

**Goal:** the wireframe's business rules as tested, framework-free TypeScript that the browser and the future API share.

**What we do**

- Port from the wireframe:
  - `scoreDevice`: the provisioning, performance, compliance and experience pillars
  - `buildModel`: persona health, share below baseline, ticket load, patch %, average boot time, people moved in and out, exceptions
  - `fitClass` / fit by persona: fit, under-provisioned, over-provisioned, critically mismatched
  - `cpuTier`, health bands (Healthy / Watch / At risk), confidence bands, ticket baseline status
  - Switch impact metrics (`swMetrics`)
- Define shared types: `Baseline`, `Weights`, `Device`, `Ticket`, `PersonaDef`, `PersonaModel`.

**Test checkpoint**

- Vitest unit tests for every rule, including edge cases (exactly on the baseline, above it, below on one part, below on two).
- Coverage report reviewed.

---

## Step 3 — Sample data + mock API

**Goal:** the same sample data as the wireframe, reached through the `/api/*` endpoints the real backend will expose.

**What we do**

- Port the seeded generator (`mulberry32`, seed `20260815`), keeping the same order of random calls so every number matches the wireframe:
  - personas, app catalogues, default baselines, weights
  - sample devices with tickets and installed apps
  - migrations, app exceptions, job-title mapping rows, incidents, service requests
- Add MSW (Mock Service Worker) handlers for the architecture endpoints:
  - `GET /api/personas/summary`, `/api/fleet/devices`, `/api/baselines`
  - `GET /api/mapping/summary`, `/api/mapping/review`
  - `GET /api/tickets/summary`
  - `GET /api/change/migrations`, `/api/change/exceptions`
  - `POST /api/persona-changes`, `GET /api/persona-changes`
  - `POST /api/devices/{did}/provisioning-requests`
- Turn the mock API on with `VITE_USE_MOCKS=true`.

**Test checkpoint**

- Tests confirm the generated totals match the wireframe (7 personas, 12,095 devices, 12,095 mapped titles).
- Every endpoint returns data in the browser's Network tab.

---

## Step 4 — App shell

**Goal:** the frame every page sits in.

**What we do**

- Routes:
  - `/personas`
  - `/personas/:pid`
  - `/personas/:pid/devices/:did`
  - `/baselines/:pid?`
  - `/tickets`
  - `/change`
  - `/switch`
- Top bar: brand, navigation, MOTION and CHART NAMES toggles, TOUR button (wired up in step 11), theme picker.
- Breadcrumbs and back button.
- All 7 themes (Midnight Indigo, Carbon, Nord Frost, Ember, Deep Teal, Daylight, Parchment) as CSS variables.
- Zustand store for UI state: theme, motion, chart names, filters, draft baselines.
- Shared components: `Panel`, `Kpi`, `Chip`, `Sect`, `PageHead`, `Avatar` (7 persona avatars), `Icon`, `AnimNum`.
- TanStack Query client and API hooks.

**Test checkpoint**

- Click through every nav item and breadcrumb.
- Switch all 7 themes.
- Refresh on a deep link (for example `/personas/DEV`) and confirm it still loads.

---

## Step 5 — Chart library

**Goal:** every D3 chart from the wireframe as a reusable React component.

**What we do**

- Components:
  - Persona ring, pillar gauge
  - Baseline histogram, binned histogram
  - Boot-time vs free-disk scatter
  - Stacked age by priority, compliance by site
  - Donuts: tickets, personas, fit
  - Week bars, trend area, bullet chart, bar list
  - Migration flow, fit stacked bar
- Charts take their colours from the active theme.
- Replay animation when a view opens (arcs sweep, bars grow, lines draw, dots pop, numbers count up); fully off when MOTION is off or the OS asks for reduced motion.
- "Chart names" labels on each chart.
- Temporary `/dev/charts` page showing every chart with sample input.

**Test checkpoint**

- Compare `/dev/charts` against the wireframe in a light and a dark theme, with motion on and off.

---

## Step 6 — Personas page

**Goal:** the landing screen (wireframe "01 · WHO").

**What we do**

- Page heading with "All personas" / "Needs attention" filter.
- KPI row: personas, devices in estate, under baseline, open tickets.
- Persona ring grid; each card opens its persona page.
- Mapping confidence section:
  - Persona selector
  - Average confidence, distinct job titles, titles mapped
  - Three confidence bands (100%, 50–99%, under 50%) that filter the review queue
  - "Job title by persona" and "Department by persona" donuts with legends
  - Searchable review queue (lowest confidence first, first 150 rows)

**Test checkpoint**

- Every number matches the wireframe.
- Filter, band, donut and search interactions behave as in the wireframe.

---

## Step 7 — Persona page + Device page

**Goal:** the persona drill-down and the single-device view.

**What we do**

- **Persona page:**
  - Identity band with health score and ring
  - 8 KPIs
  - Health composition: pillar gauge, 12-week trend, device health spread
  - Provisioning against baseline: memory, storage, CPU (with link to Baselines)
  - Experience and compliance: scatter, patch by site, ticket mix donut (filters the device table)
  - Support load: age and priority, top reported issues, estate mix
  - Movement and app exceptions
  - Device table: search, worst first, click through to a device
- **Device page:**
  - Header with device health score
  - 7 bullet charts against the persona baseline
  - Application entitlement: entitled, missing, outside persona
  - ServiceNow tickets for the device
  - "Raise provisioning request" (calls the mock API)
  - Suggested actions

**Test checkpoint**

- Open several personas and devices and compare with the wireframe.
- The provisioning request returns a ticket number and shows the confirmation.

---

## Step 8 — Baselines page

**Goal:** the baseline contract editor with live re-grading (wireframe "02 · WHAT THEY GET").

**What we do**

- Persona strip to pick the persona being edited.
- Fit tiles: total devices, fit, under-provisioned, over-provisioned, critically mismatched.
- Contract sliders for 8 fields (memory, storage, CPU, boot time, crashes, free disk, battery, ticket ceiling), with changed values highlighted.
- Live impact panel (ring, below-baseline count and share, provisioning pillar, composite health).
- Fit donut, fit-by-persona stacked bar, component match heat table, baseline reference table.
- Persona app catalogue.
- Unsaved-changes indicator and reset.
- Draft baselines kept in the Zustand store so every page grades against them.

**Test checkpoint**

- Moving a slider updates the tiles, charts and tables instantly.
- The ticket ceiling changes the Tickets page.
- Reset restores the defaults.

---

## Step 9 — Tickets page

**Goal:** support load graded against each persona's ticket ceiling (wireframe "03 · WHAT IT COSTS").

**What we do**

- Incidents / service requests switch, persona filter, clearable category filter.
- 6 headline KPIs: total, unique requestors, per user, ticket baseline, personas over baseline, worst variance.
- 4 status KPIs: still open, resolved (or fulfilled), past SLA age, top category (or catalogue item).
- Category donut with legend (click to filter) and top 10 departments.
- Weekly volume and age-by-priority charts.
- Persona ticket health table: baseline hardware, tickets, per user, baseline, variance bar, status, Investigate link.

**Test checkpoint**

- Totals match the wireframe in both modes.
- Category filter works.
- Changing a ticket ceiling on Baselines re-grades the table.

---

## Step 10 — Change page + Switch page

**Goal:** what is shifting (wireframe "04 · WHAT IS SHIFTING") and the persona change workflow ("05 · SWITCH").

**What we do**

- **Change page:**
  - KPIs: persona changes, people reassigned, app exceptions, exceptions pending
  - Migration flow chart and most-requested apps outside a persona
  - By-persona table (moved in, moved out, net, exceptions, pending)
- **Switch page:**
  - Step 1: select a user (grouped by persona)
  - Step 2: current persona, picked automatically
  - Step 3: choose the new persona
  - Step 4: impact KPIs and the before/after table (productivity, tasks automated, apps added and removed, security risk, fit, RAM, storage, boot, tickets, onboarding, experience)
  - Apply (calls `POST /api/persona-changes`) and Start again
  - Persona change log with links to the persona page and Change page

**Test checkpoint**

- Apply a switch, then confirm the user moved and the counts on Personas, Change and the persona page updated.
- The change log shows the entry.

---

## Step 11 — Guided tour

**Goal:** the self-driving walkthrough for demos and recordings.

**What we do**

- Port all 18 tour steps with their captions, timings and target screens.
- Title card, caption panel, progress bar, control bar (previous, pause/resume, next, step counter, captions on/off, exit).
- Each step moves to its route, sets its filters (confidence band, ticket mode, persona) and scrolls to the target section.
- Keyboard shortcuts: Space pause, ← → step, C captions, Esc exit.
- Exiting the tour restores the default page state.

**Test checkpoint**

- Play the full tour end to end without touching anything.
- Test every control and keyboard shortcut.

---

## Step 12 — Quality pass + deploy

**Goal:** production-ready front end on Azure Static Web Apps.

**What we do**

- Responsive check at phone, tablet and desktop widths.
- Reduced-motion support and accessibility basics: focus states, labels, contrast in all 7 themes.
- Remove the temporary `/dev/charts` page.
- Playwright smoke tests for every page and the main interactions.
- GitHub Actions workflow: lint, tests, build, deploy to Azure Static Web Apps, with a preview environment per pull request.
- Final `staticwebapp.config.json`: routes, security headers.

**Test checkpoint**

- Playwright suite passes in CI.
- Deployed preview URL checked on desktop and phone.

---

## Notes and decisions

- **Package manager:** npm workspaces (pnpm is not installed).
- **Dropped from the wireframe:** the Excel / "Connect Dataverse" link. The Fabric API replaces it in the backend phase.
- **Parity reference:** keep `personalfleet.html` in the project folder to compare numbers and visuals against the React app.
- **Out of scope for the front-end phase:** the Azure Functions API, Fabric data platform, Entra sign-in and role checks. The mock API stands in for these until the backend phase.
- **TypeScript pinned to 6.0.x:** `typescript-eslint` 8.70 supports TypeScript below 6.1.

---

## Commands

| Command              | What it does                                         |
| -------------------- | ---------------------------------------------------- |
| `npm install`        | Install all workspace dependencies                   |
| `npm run dev`        | Start the web app at http://localhost:5173           |
| `npm run build`      | Typecheck and build the web app into `apps/web/dist` |
| `npm run preview`    | Serve the production build locally                   |
| `npm test`           | Run all Vitest tests (web + scoring)                 |
| `npm run test:watch` | Run tests in watch mode                              |
| `npm run typecheck`  | Typecheck every workspace                            |
| `npm run lint`       | ESLint across the repository                         |
| `npm run format`     | Format with Prettier (`format:check` to verify only) |

---

## Step log

### Step 1 — Project scaffold (17 Sep 2026)

**Built**

- Root: npm workspaces, `tsconfig.base.json` (strict), `eslint.config.js` (flat config: TypeScript, React Hooks, React Refresh), Prettier, root `vitest.config.ts` running every workspace as a test project, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc` (Node 22).
- `packages/scoring`: `@pfc/scoring`, consumed as TypeScript source (no build step), placeholder export + test.
- `apps/web`: `@pfc/web`, React 19 + Vite 8, jsdom + Testing Library test setup, placeholder page that imports `@pfc/scoring` to prove the workspace link, `public/staticwebapp.config.json`.
- Git repository initialised; pushed to GitHub as the first commit on `main`.

**Versions:** React 19.3 · Vite 8.3 · TypeScript 6.0.3 · Vitest 5.0 · ESLint 10.10 · typescript-eslint 8.70 · Prettier 3.9

**Test results**

| Check                                | Result                                |
| ------------------------------------ | ------------------------------------- |
| `npm run typecheck`                  | Pass (web, scoring)                   |
| `npm run lint`                       | Pass, no warnings                     |
| `npm run format:check`               | Pass                                  |
| `npm test`                           | Pass: 2 test files, 2 tests           |
| `npm run build`                      | Pass: 219.9 kB JS (68.7 kB gzipped)   |
| Dev server `/`                       | HTTP 200, placeholder page renders    |
| Dev server deep link `/personas/DEV` | HTTP 200 (served by the SPA fallback) |

**Azure Static Web Apps + continuous deployment**

| Item            | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| Resource        | `swa-persona-fleet` (Static Web App, **Free** plan)                                       |
| Resource group  | `Shashi-RG` · subscription DFS CoE-DWP                                                    |
| URL             | https://agreeable-coast-025d2f100.2.azurestaticapps.net                                   |
| Deployment auth | GitHub (OIDC) + secret `AZURE_STATIC_WEB_APPS_API_TOKEN_AGREEABLE_COAST_025D2F100`        |
| Workflow        | `.github/workflows/azure-static-web-apps-agreeable-coast-025d2f100.yml`                   |
| Pipeline        | `npm ci` → lint → test → build → upload `apps/web/dist` (`skip_app_build: true`)          |
| Actions         | `checkout@v7`, `setup-node@v7`, `github-script@v9` (Node 24), `static-web-apps-deploy@v1` |
| Triggers        | Push to `main` → production · PR into `main` → preview environment (removed on close)     |

| Deployment check                        | Result                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| GitHub Actions run (all steps)          | Pass: Install, Lint, Test, Build, Get Id Token, Deploy |
| Live `/`                                | HTTP 200, placeholder page                             |
| Live deep link `/personas/DEV`          | HTTP 200                                               |
| Headers from `staticwebapp.config.json` | `X-Content-Type-Options`, `Referrer-Policy` present    |

**Notes**

- First create attempt failed: _Enterprise-grade edge_ is not allowed on the Free plan. Leave it unchecked.
- Upgrade to **Standard** (Settings → Hosting plan) before the backend phase, for the linked Azure Functions backend and custom Entra sign-in.
- The warning `Unexpected input(s) 'github_id_token'` also appears with Azure's generated workflow and does not affect deployment.
