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
| 2   | Scoring package            | Done        | 17 Sep 2026   |
| 3   | Sample data + mock API     | Done        | 17 Sep 2026   |
| 4   | App shell                  | Done        | 17 Sep 2026   |
| 5   | Chart library              | Testing     |               |
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
  - `GET /api/personas`, `/api/baselines`, `/api/catalog`, `/api/fleet/devices`
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

| Command                 | What it does                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm install`           | Install all workspace dependencies                                                                              |
| `npm run dev`           | Start the web app at http://localhost:5173                                                                      |
| `npm run build`         | Typecheck and build the web app into `apps/web/dist`                                                            |
| `npm run preview`       | Serve the production build locally                                                                              |
| `npm test`              | Run all Vitest tests (web + scoring)                                                                            |
| `npm run test:watch`    | Run tests in watch mode                                                                                         |
| `npm run test:coverage` | Run tests with a coverage report (HTML in `coverage/`)                                                          |
| `npm run typecheck`     | Typecheck every workspace                                                                                       |
| `npm run lint`          | ESLint across the repository                                                                                    |
| `npm run format`        | Format with Prettier (`format:check` to verify only)                                                            |
| `npm run smoke`         | Click through the production build in Chrome (run `npm run build` first; `SMOKE_URL=…` to test a deployed site) |

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

### Step 2 — Scoring package (17 Sep 2026)

**Built** — `packages/scoring/src`, pure TypeScript with no runtime dependencies (`d3.mean`/`d3.sum` replaced by local helpers that return 0 instead of `undefined` for empty lists).

| File         | Contents (wireframe source)                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`   | `PersonaDef`, `Baseline`, `Weights`, `Device`, `DeviceTicket`, `Migration`, `AppException`, `ScoredDevice`, `Pillars`, `PersonaModel`, `Tone` |
| `math.ts`    | `clamp`, `sum`, `mean`                                                                                                                        |
| `bands.ts`   | `healthTone` / `healthLabel` (`band`, `bandLabel`), `confBand`, `cpuTier`, `complianceTone` (site patch colours)                              |
| `device.ts`  | `scoreDevice` (provisioning, performance, compliance, experience pillars + `underProv`), `deviceScore` (35/30/20/15 composite)                |
| `persona.ts` | `buildPersonaModel` / `buildModel` (`buildModel`), `supportScore`, `personaHealth`                                                            |
| `fit.ts`     | `fitClass`, `fitByPersona`, `FIT_KINDS`                                                                                                       |
| `tickets.ts` | `ticketBaselinePerUser`, `ticketStatus`, `gradeTicketLoad` (per-user load, ceiling, variance, status for the Tickets page)                    |
| `switch.ts`  | `switchMetrics` (`swMetrics`), `securityRisk`, `RISK_RANK`                                                                                    |

**Design choices**

- Rules return a semantic `Tone` (`good` / `warn` / `bad`) instead of colours; the web app maps tones to the active theme.
- Headcount (`count`) and sample rows (`devices`) stay separate, as the wireframe's naming note requires.
- Empty personas (possible after persona switches) produce zeros, never `NaN`.
- Wireframe demo data (`personaTrend`, persona definitions, default baselines, weights) is not part of this package; it moves to the sample-data generator in step 3.

**Test results**

| Check                   | Result                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| `npm run typecheck`     | Pass                                                                        |
| `npm run lint`          | Pass, no warnings                                                           |
| `npm run format:check`  | Pass                                                                        |
| `npm test`              | Pass: 9 test files, 94 tests                                                |
| `npm run test:coverage` | 100% statements (96/96), branches (88/88), functions (50/50), lines (84/84) |
| `npm run build`         | Pass                                                                        |

**Covered cases:** exactly on / above / below baseline; below on one, two and three parts; above on one part while below on another; clamping at 0 and 100; every band boundary; Windows 10 vs 11 and patched vs unpatched; ticket ceiling within / near / over; zero users; persona with no devices; baseline change re-grades health; switch to lighter and heavier personas; missing app catalogue. Expected values are calculated by hand from the wireframe formulas and noted in the tests.

**Parity note:** confirmed in step 3 — `parity.test.ts` runs the wireframe's own `buildModel` and `fitByPersona` and matches this package to 9 decimal places.

### Step 3 — Sample data + mock API (17 Sep 2026)

**Built**

| Path (under `apps/web/src`)                | Contents                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mocks/data/random.ts`                     | `mulberry32` seeded PRNG, `pick`, `iBetween`                                                                                                      |
| `mocks/data/catalog.ts`                    | All static wireframe data: personas, apps, default baselines, weights, models, names, sites, ticket and request titles, rates, departments, roles |
| `mocks/data/generate.ts`                   | `generateFleetData(seed)`: sample devices, exceptions, job-title rows, incidents, service requests, in the wireframe's exact random-call order    |
| `mocks/data/wireframe.ts`                  | Test helper that runs the wireframe's own JavaScript from `reference/personalfleet.html`                                                          |
| `mocks/db.ts`                              | In-memory mock database (lazy, resettable; resets on page reload)                                                                                 |
| `mocks/aggregate.ts`                       | Server-side aggregations: `mappingSummary`, `mappingReview`, `ticketSummary`, `ageByPriority`, `tally`                                            |
| `mocks/handlers.ts`                        | MSW handlers for every endpoint below                                                                                                             |
| `mocks/browser.ts` / `server.ts`           | Mock API for the browser (service worker) and for tests (Node)                                                                                    |
| `api/types.ts`                             | API contract types shared by the mock API and the future Azure Functions API                                                                      |
| `api/client.ts`                            | `apiGet` / `apiPost` fetch wrapper with `ApiRequestError`                                                                                         |
| `ApiCheck.tsx`, `apiChecks.ts`             | **Temporary** page that calls every endpoint (removed in step 4)                                                                                  |
| `.env`                                     | `VITE_USE_MOCKS=true`                                                                                                                             |
| `reference/personalfleet.html` (repo root) | The wireframe, used as the parity reference                                                                                                       |

**API contract**

| Method & path                                          | Returns                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/personas`                                    | Persona definitions with current headcount                                                                               |
| `GET /api/baselines`                                   | Default baselines and pillar weights per persona                                                                         |
| `GET /api/catalog`                                     | App catalogues, tasks automated, onboarding days, ticket categories, request catalogue items                             |
| `GET /api/fleet/devices`                               | Sample devices per persona (with tickets and installed apps)                                                             |
| `GET /api/mapping/summary?persona=`                    | Average confidence, distinct titles, titles mapped, band counts, titles and departments per persona                      |
| `GET /api/mapping/review?persona=&band=&q=`            | Review queue, lowest confidence first, max 150 rows, plus the full match count                                           |
| `GET /api/tickets/summary?type=inc\|req&persona=&cat=` | Totals, unique requestors, open, past SLA, by category, top 10 departments, 12 weeks, age × priority, per-persona totals |
| `GET /api/change/migrations`                           | People moved between personas                                                                                            |
| `GET /api/change/exceptions`                           | App exceptions                                                                                                           |
| `GET /api/persona-changes`                             | Change log, newest first                                                                                                 |
| `POST /api/persona-changes` `{ userId, to }`           | `201` + change; moves the device, updates headcounts, migrations and log. `400` / `404` on bad input                     |
| `POST /api/devices/{did}/provisioning-requests`        | `201` + `INC00…` number routed to EUC-Provisioning; `404` for unknown device                                             |

Baseline-dependent numbers (health, fit, ticket status) are not computed by the API: the browser grades them with `@pfc/scoring` against draft baselines, so the Baselines sliders stay instant.

**Reference numbers (sample data)**

| Measure                        | Value                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Personas / devices in estate   | 7 / 12,095                                                                           |
| Sample devices                 | 182 (KW 34, CC 28, others 24)                                                        |
| Job titles mapped              | 12,095 · avg confidence 99.20% · 2,671 distinct titles                               |
| Confidence bands               | 100%: 11,891 · 50–99%: 103 · under 50%: 101                                          |
| Incidents                      | 2,063 · 1,744 unique requestors · 1,169 open · 940 past SLA · top Connectivity (374) |
| Service requests               | 1,438 · 1,296 unique requestors · 485 open · top Laptop Request (208)                |
| Persona changes / people moved | 7 / 468                                                                              |
| App exceptions                 | 56 (15 pending)                                                                      |

**Test results**

| Check                   | Result                                                                                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wireframe parity        | Pass: personas, apps, baselines, weights, all 182 devices, migrations, 56 exceptions, 12,095 title rows, 2,063 incidents, 1,438 requests are **identical**; persona health, pillars, counts, device scores and fit match to 9 decimal places, including after a baseline edit |
| Seed sensitivity        | A different seed produces different data (the parity test can fail)                                                                                                                                                                                                           |
| Mock API over HTTP      | Every endpoint, filters, persona change side effects, error responses                                                                                                                                                                                                         |
| `npm test`              | Pass: 13 test files, 155 tests                                                                                                                                                                                                                                                |
| `npm run test:coverage` | 98.3% statements, 97.2% branches, 97.6% functions, 99.4% lines                                                                                                                                                                                                                |
| Typecheck, lint, format | Pass                                                                                                                                                                                                                                                                          |
| `npm run build`         | Pass; `mockServiceWorker.js` in `dist`; mock API is a separate lazy chunk (164.7 kB gzipped)                                                                                                                                                                                  |

**Notes**

- `personaTrend` (the 12-week health line) is derived from live health in the browser, so it is built with the Persona page in step 7.
- The mock database resets on page reload, like the wireframe without the Excel link.
- **Verified in the browser on the live site (17 Sep 2026):** all 11 read endpoints return OK through the service worker, with the reference numbers above.

### Step 4 — App shell (17 Sep 2026)

**Built** (under `apps/web/src`)

| Path                     | Contents                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `styles/global.css`      | The wireframe stylesheet ported verbatim (excluded from Prettier so it stays diffable against the wireframe), plus router link styles                 |
| `theme/themes.ts`        | 7 themes, `applyTheme` (CSS variables + `color-scheme`), `isThemeKey`                                                                                 |
| `store/ui.ts`            | Zustand store: theme, motion, chart names (persisted to `localStorage`); page filters and draft baselines (reset on reload)                           |
| `api/queries.ts`         | TanStack Query hooks for every endpoint; persona-change mutation invalidates personas, devices, migrations, change log                                |
| `model/useFleetModel.ts` | Combines API data with draft baselines and grades the fleet with `@pfc/scoring` in the browser                                                        |
| `routes.tsx`, `App.tsx`  | Route table (React Router 8) and providers                                                                                                            |
| `layout/`                | `AppLayout` (theme + body classes, scroll to top), `Topbar`, `Crumbs`                                                                                 |
| `components/`            | `Icon` (19 icons), `Avatar` (7 personas), `AnimNum`, `Panel`, `Kpi`, `Sect`, `ChartType`, `Chip`, `PageHead`, `Loading`, `ErrorMessage`, `ComingSoon` |
| `lib/`                   | `gb`, `formatNum`, `toneColor`, `createQueryClient`                                                                                                   |
| `pages/`                 | Placeholder pages with live headline numbers; `NotFoundPage`, `RouteError`                                                                            |
| `test/renderApp.tsx`     | Renders the whole app at a URL with the mock API, for integration tests                                                                               |

**Routes**

| Path                          | Page                    | Shows now (placeholder)                                                   |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `/`                           | Redirect to `/personas` |                                                                           |
| `/personas`                   | Personas                | 4 KPIs, persona cards with health, All / Needs attention filter           |
| `/personas/:pid`              | Persona                 | Identity band with health, 8 KPIs, 5 worst devices (links to device page) |
| `/personas/:pid/devices/:did` | Device                  | Device header with health                                                 |
| `/baselines/:pid?`            | Baselines & device fit  | Persona strip, baseline contract summary                                  |
| `/tickets`                    | Tickets                 | Incidents / requests switch, 4 KPIs                                       |
| `/change`                     | Change                  | 4 KPIs                                                                    |
| `/switch`                     | Persona change          | Heading                                                                   |
| anything else                 | Not found               | Link back to Personas                                                     |

**Behaviour carried over from the wireframe:** nav highlighting (Personas stays active on persona and device pages), breadcrumbs (section label; persona name and device host on drill-down pages; not on Baselines), back button (device → persona → Personas), theme picker, MOTION and CHART NAMES toggles as body classes, scroll to top on navigation, count-up numbers when MOTION is on.

**Changes from the wireframe**

- The TOUR button is visible but disabled until step 11; a **DEMO DATA** mark shows while the mock API is on. The CONNECT DATAVERSE button is gone.
- Theme, motion and chart-name choices persist across reloads.
- "Net people moved" no longer shows `+-149` when more people left than joined (wireframe bug).
- Unknown personas, devices and URLs show a not-found page instead of a blank screen.

**Test results**

| Check                   | Result                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`              | Pass: 16 test files, 203 tests, no React warnings                                                                                                                                                                                                                                                                                                                                 |
| Integration tests       | Redirect; every route by deep link; not-found cases; every nav item and active state; all 7 themes write CSS variables; MOTION / CHART NAMES body classes; breadcrumbs and links; back button chain; Needs attention filter; persona → device navigation; incidents / requests switch; live KPI numbers (12,095 devices, 2,063 incidents, 1,438 requests, 468 people, 15 pending) |
| Unit tests              | Store (drafts, reset, persistence, invalid stored theme), themes, avatars, icons, `AnimNum`, `Kpi`                                                                                                                                                                                                                                                                                |
| `npm run test:coverage` | 94.6% statements, 94.1% branches, 91.4% functions, 95.1% lines                                                                                                                                                                                                                                                                                                                    |
| Typecheck, lint, format | Pass, no warnings                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build`         | Pass: app 132.0 kB gzipped; mock API chunk 164.7 kB gzipped (loaded only with mocks on)                                                                                                                                                                                                                                                                                           |

**Notes**

- Bundle size (React, React Router, TanStack Query, D3) is reviewed in step 12.

### Step 5 — Chart library (17 Sep 2026)

**Built** (under `apps/web/src`)

| Path                              | Contents                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `charts/core.tsx`                 | `SvgFluid`, `Txt`, animated primitives `AnimArc`, `AnimRect`, `DrawPath`, `FadePath`, `PopCircle`, `AnimText`                                   |
| `charts/rings.tsx`                | `PersonaRing`, `PillarGauge`                                                                                                                    |
| `charts/bars.tsx`                 | `BaselineHistogram`, `BinHistogram`, `WeekBars`, `StackedAge`                                                                                   |
| `charts/horizontal.tsx`           | `ComplianceBySite`, `FitStack`                                                                                                                  |
| `charts/Donut.tsx`                | `Donut` — one component for the wireframe's four donuts (ticket mix, tickets page, persona, fit); slices are keyboard-accessible filter buttons |
| `charts/lines.tsx`                | `TrendArea`, `BootScatter`, `MigrationFlow`                                                                                                     |
| `charts/html.tsx`                 | `Bullet`, `BarList`                                                                                                                             |
| `charts/colors.ts`, `geometry.ts` | Category colour scales; `arcPath`, `MONO`                                                                                                       |
| `motion/`                         | Animation clock: `useMotionElapsed`, `MotionFrame` (one clock per chart), `Replay` (restart on filter change), `progress`, `ease`               |
| `theme/usePalette.ts`             | Active theme colours for SVG; `bandColor`                                                                                                       |
| `lib/`                            | `aggregate.ts` (`tally`, `ageByPriority`, shared with the mock API), `categories.ts`, `random.ts`, `trend.ts` (`personaTrend`)                  |
| `pages/DevChartsPage.tsx`         | **Temporary** `/dev/charts` page: every chart on live mock data, persona switcher, Replay button (removed in step 12)                           |

**How animation works:** the wireframe animates by letting D3 transitions rewrite DOM attributes after rendering. In React that would fight re-renders (a slider change mid-animation would be overwritten). Instead each chart reads one clock (milliseconds since the view opened) and computes every element's eased progress with the wireframe's delays and durations — arcs sweep 850 ms, bars grow 700 ms, lines draw 1000 ms, dots pop 430 ms with overshoot, numbers count 900 ms. React owns every attribute; with MOTION off or OS reduced motion, charts render their final state directly.

**Test results**

| Check                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart parity            | Pass: 22 comparisons render the wireframe's own chart functions and the React components on the same data and compare every `svg/path/rect/circle/line/text/stop` with all geometry, colour, opacity, transform and text attributes — **identical** for persona ring (4 cases), pillar gauge, RAM and disk histograms, device-health and CPU binned histograms, scatter, stacked age, compliance by site, ticket-mix donut (with and without a filter), Tickets-page donut (incidents; requests with a filter), persona donut, week bars, trend area, bullets, bar list widths, migration flow, fit donut, fit stack |
| Parity sensitivity      | A one-point health change, a different persona avatar or a missing persona row makes the comparison fail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Animation               | Bars grow from 0, numbers count up and land on the exact value, `Replay` restarts, new data after the animation shows immediately, MOTION off and OS reduced motion render final state, bar-list fills animate                                                                                                                                                                                                                                                                                                                                                                                                       |
| Interaction             | Donut slices select by click, Enter and Space; dimming and `aria-pressed`; charts use the active theme's colours                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dev page                | All 16 chart types render on live mock data; persona switch and slice selection work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test`              | Pass: 18 test files, 240 tests, no React warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:coverage` | 96.2% statements, 89.9% branches, 94.6% functions, 96.7% lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Typecheck, lint, format | Pass, no warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run build`         | Pass: app 149.1 kB gzipped; mock API chunk 164.4 kB gzipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Notes**

- `stackedAge` now takes pre-bucketed counts (`ageByPriority`), so the Tickets page can use the API's aggregation and the Persona page its own device tickets.
- The wireframe's donut centre shows raw totals until its animation finishes, then adds thousands separators; the React version always shows separators.

**Fix after review — "l is not a function" on the live site (17 Sep 2026)**

| Item         | Detail                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symptom      | After changing theme, clicking a persona card showed "Something went wrong — l is not a function". Loading the URL directly worked.                                                                                                                                                                                                         |
| Cause        | `AppLayout` had `useEffect(() => applyTheme(theme), [theme])`. The production minifier inlined `applyTheme` as a comma expression, so the arrow returned the string `"light"` / `"dark"`. React treated it as the effect cleanup and called it on the next render. Development builds and unit tests do not minify, so every check passed.  |
| Fix          | Effects in `AppLayout` use block bodies.                                                                                                                                                                                                                                                                                                    |
| Guard 1      | ESLint rule (`no-restricted-syntax`) rejects expression-bodied `useEffect` / `useLayoutEffect` / `useInsertionEffect`.                                                                                                                                                                                                                      |
| Guard 2      | `e2e/smoke.mjs` (`npm run smoke`): serves the **minified** build and clicks through 24 steps in real Chrome (themes, toggles, filters, persona → device → back, every nav item, chart library, deep link + reload, unknown URL), failing on any page or console error. Added to CI after Build, so a broken production build cannot deploy. |
| Verification | Smoke test against the broken live build: **failed** with the exact error. Against the fixed build: **passed**, 24 steps, no browser errors.                                                                                                                                                                                                |
| Also         | Added `favicon.svg` (the brand mark), removing a 404 on every page load.                                                                                                                                                                                                                                                                    |
