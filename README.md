# Persona Fleet Command

Endpoint experience portal: personas, the device baselines behind them, the tickets they cost, and how people move between them. React front end on Azure Static Web Apps, built from the `reference/personalfleet.html` wireframe.

**Live:** https://agreeable-coast-025d2f100.2.azurestaticapps.net (demo data from an in-browser mock API)

## Pages

| Page      | Route                         | What it shows                                                                   |
| --------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Personas  | `/personas`                   | Persona health rings; job-title mapping confidence and review queue             |
| Persona   | `/personas/:pid`              | Health composition, provisioning, experience, support load, movement, devices   |
| Device    | `/personas/:pid/devices/:did` | Device against its baseline, app entitlement, tickets, provisioning request     |
| Baselines | `/baselines/:pid`             | Fleet fit, the baseline contract (sliders re-grade every page), component match |
| Tickets   | `/tickets`                    | Incidents and service requests graded against each persona's ticket ceiling     |
| Change    | `/change`                     | People moving between personas, apps requested outside a catalogue              |
| Switch    | `/switch`                     | Move a user to another persona after reviewing the impact                       |

The top bar also has seven themes, MOTION, CHART NAMES and a self-driving **TOUR**.

## Repository

| Path                           | Contents                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                     | React 19 + TypeScript + Vite app: pages, charts (D3 maths, React SVG), mock API (MSW)                                         |
| `apps/api`                     | Azure Functions API serving `/api/*` from Microsoft Fabric (in build; see `backend.md`)                                       |
| `packages/contract`            | The `/api/*` contract: response types and the aggregations behind them, shared by the app and the API                         |
| `packages/scoring`             | Business rules shared by the app and the future API: device and persona scoring, fit, ticket grading, switch impact           |
| `e2e`                          | `smoke.mjs` (clicks through the production build in Chrome) and `audit.mjs` (layout at 3 widths, axe WCAG 2.1 AA in 7 themes) |
| `reference/personalfleet.html` | The wireframe; parity tests run its code and compare the results                                                              |
| `frontend.md`                  | Build plan, step-by-step log, decisions and reference numbers                                                                 |

## Commands

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit, page and wireframe-parity tests
npm run build
npm run smoke          # after build; SMOKE_URL=https://… for a deployed site
npm run audit          # after build; AUDIT_URL=https://… for a deployed site
```

Requires Node 22 and Google Chrome (for `smoke` and `audit`).

## Deployment

Every push to `main` runs lint, tests, build, smoke test and audit in GitHub Actions, then deploys to Azure Static Web Apps. Pull requests get a preview URL.

`VITE_USE_MOCKS=true` (in `apps/web/.env`) serves `/api/*` from the mock API. The Azure Functions + Microsoft Fabric backend is described in `Persona-Fleet-Command-Architecture.html`.
