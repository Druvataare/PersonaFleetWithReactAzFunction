# Persona Fleet Command — Backend build plan

Phase two: replace the mock API with real data from Microsoft Fabric, without changing the `/api/*` contract the front end is already built and tested against.

**Target stack:** Azure Functions (Node 22 · TypeScript · v4 model, Flex Consumption) · Fabric lakehouse SQL analytics endpoint · SQL database in Fabric (configuration + writeback) · Fabric notebook/pipeline for the gold layer · Entra ID + managed identity · Azure Static Web Apps (linked backend) · Vitest

**Repository:** [Druvataare/PersonaFleetWithReactAzFunction](https://github.com/Druvataare/PersonaFleetWithReactAzFunction) (branch `main`, one commit per step)

**Live site:** https://agreeable-coast-025d2f100.2.azurestaticapps.net

**Related documents:** [frontend.md](frontend.md) · [Persona-Fleet-Command-Architecture.html](Persona-Fleet-Command-Architecture.html) · [sql/discovery.sql](sql/discovery.sql)

---

## Progress

| #   | Step                            | Status      | Date approved |
| --- | ------------------------------- | ----------- | ------------- |
| 1   | Data discovery                  | Done        | 18 Sep 2026   |
| 2   | Gold layer build                | Not started | —             |
| 3   | Functions app scaffold          | Not started | —             |
| 4   | Fabric connection layer         | Not started | —             |
| 5   | Configuration store             | Not started | —             |
| 6   | Reference endpoints             | Not started | —             |
| 7   | Fleet devices endpoint          | Not started | —             |
| 8   | Mapping + aggregate endpoints   | Not started | —             |
| 9   | Change endpoints and writeback  | Not started | —             |
| 10  | Auth, caching and performance   | Not started | —             |
| 11  | Contract tests, cutover, deploy | Not started | —             |

Status values: `Not started` · `In progress` · `Testing` · `Done`

---

## Discovery results — 18 Sep 2026

Measured with [sql/discovery.sql](sql/discovery.sql) against the lakehouse SQL analytics endpoint.

| Finding                                   | Value                                                             | Effect                                               |
| ----------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `dimuser` / `dimdevice` / identity bridge | 5,000 / 5,000 / 5,000                                             | Small estate; devices ship whole, not paged          |
| `fact_device_score_daily`                 | **0 rows**                                                        | **DEX pillar scores unavailable** — AD-12            |
| `fact_device_metric_daily`                | **0 rows**                                                        | No pre-computed measures at all                      |
| `tbl_brz_bootperf_event`                  | 881,570                                                           | Boot time is well covered                            |
| `tbl_brz_systeminfo_software`             | 7,800,000 (~1,560 apps per device)                                | `installed[]` must be filtered — AD-13               |
| `IsSynthetic`                             | **1 for every row** in users, devices and data sources            | Synthetic estate — AD-14                             |
| `dimuser.Persona`                         | **6 personas**, not the portal's 7 (see below)                    | Persona set comes from data — AD-15                  |
| Job titles                                | 21 distinct, **each mapping to exactly one persona**              | Confidence cannot be derived this way                |
| `dimdevice.DeviceId` vs `EntraDeviceId`   | 5,000 bridge joins on `DeviceId`, **0** on `EntraDeviceId`        | Bridge is mandatory — AD-7 confirmed                 |
| Devices joined to a user                  | 5,000 of 5,000                                                    | Full persona coverage for devices                    |
| Distinct CPU models                       | **5**                                                             | CPU score lookup is a 5-row table                    |
| Hardware configurations                   | **5 fixed tiers**; CPU decides RAM and SSD                        | Baselines must sit on a tier (see seed values)       |
| Hardware mix by persona                   | **Same in every persona**: ~23% 8 GB, ~56% 16 GB, ~21% 32 GB      | Hardware ignores persona — the portal's core finding |
| `tbl_brz_epfix_eventlifecycle`            | 43,017 jobs · 27,501 success · 7,991 failed · **3,508 escalated** | Usable ticket substitute — AD-10                     |

### The six personas in the data

| `dimuser.Persona` | Users | Portal key | Notes                                    |
| ----------------- | ----- | ---------- | ---------------------------------------- |
| Knowledge Worker  | 1,542 | `KW`       | Hardware calibrated to the 8-core tier   |
| Retail            | 1,115 | `RETAIL`   | **New** — proposed baseline, 6-core tier |
| Call Centre       | 812   | `CC`       | Portal's "Contact Centre"; 8-core tier   |
| Field Services    | 780   | `FIELD`    | Portal's "Field Engineer"; 8-core tier   |
| Engineering       | 546   | `DEV`      | 12-core tier (32 GB), as the wireframe   |
| Executive         | 205   | `EXEC`     | Moved down to the 10-core tier           |

Data Science (`DS`) and Creative Studio (`CRE`) do not exist in this estate. Ten departments, three to six job titles per persona, no unassigned users.

### What this changes

1. **We build the gold layer ourselves.** Both fact tables are empty, so there is no pre-computed device score to read. Every measure — boot time, crashes, free space, battery, patch state — is aggregated from bronze telemetry by a job we write (step 2). This is the largest addition to the original plan.
2. **The Tickets page has a real source after all.** 3,508 escalations across 1,088 devices, plus 7,991 failures, is a genuine support-load signal with a category (`escalationReason`), a requester and a timeline.
3. **Mapping confidence needs a different basis.** All 21 titles map to exactly one persona, so consistency-based confidence would return 100% for everything. Replaced with an app-fit measure (AD-16).
4. **The guided tour needs one edit.** [steps.ts:85](apps/web/src/tour/steps.ts#L85) drives step 8 with `pid: "DS"`, a persona this estate does not have. It becomes `DEV` or `RETAIL` at cutover. This is the only hardcoded persona id outside the mock data.

### Second lakehouse compared — `EPInsight_Lakehouse_Dev`

| Aspect      | First lakehouse | `EPInsight_Lakehouse_Dev`                                                   |
| ----------- | --------------- | --------------------------------------------------------------------------- |
| Base tables | 73              | Same 73, identical columns                                                  |
| Extra       | —               | `tbl_brz_network_location`, `tbl_brz_network_location_interface`            |
| Views       | none            | 6 × `vw_landing_*` — **broken**: they read four tables that no longer exist |

The views read `dimpersona`, `facttitlemapping`, `factdevicemetrics` and `factticket`, none of which is present in either lakehouse. Their _design_ matches the wireframe field for field and is adopted (AD-17); the views themselves are not used.

---

## Architectural decisions

Each decision records what we chose, why, and what it costs us. Numbered so later steps can refer to them.

### AD-1 · A backend-for-frontend, not a general-purpose API

**Decision.** Azure Functions sits between the Static Web App and Fabric, exposing exactly the eleven endpoints the portal needs and nothing else.

**Why.** The browser must never hold Fabric credentials, and the pages want whole pre-shaped payloads rather than a query language. A BFF is also where caching, authorisation and the ticket-source substitution live.

**Consequence.** The API is coupled to this front end by design. A second consumer would get its own BFF, not a widened contract.

### AD-2 · Read through the SQL analytics endpoint, not GraphQL or a semantic model

**Decision.** The BFF queries the lakehouse SQL analytics endpoint with T-SQL over `mssql`.

**Why.** Fabric API for GraphQL could serve the reads — it can expose our views directly — but it costs more than it saves here. The portal expects eleven fixed composite shapes (maps keyed by persona, nested summaries) that GraphQL returns as table-shaped rows, so the front-end data layer, mock API and tests would be rewritten or a reshaping backend kept anyway. In saved-credentials mode the database sees the API's identity rather than the user's, so writes could not be attributed without trusting the browser; in single-sign-on mode every portal user needs data permissions in Fabric. There is no cache we control, so every page view spends capacity, and results are paged, so the 5,000-device fleet becomes many round trips. Fabric User Data Functions could replace Azure Functions but are Python, so `@pfc/scoring` could not be shared (AD-6). A Direct Lake semantic model with DAX is the right answer for Power BI and the wrong one for a custom app. Reading Delta files from OneLake in Node means hand-rolling a query engine. Spark is minutes of latency — it is how gold is _built_, not how it is served. The gold views remain publishable through GraphQL later for other consumers; that choice does not affect this one.

**Consequence.** We depend on an analytics engine for interactive reads, so caching (AD-8) is not optional.

### AD-3 · Gold views are the contract boundary

**Decision.** The BFF reads only `vw_api_v1_*` views. It never names a base table.

**Why.** Upstream tables will be renamed, re-partitioned and re-modelled. When that happens we fix a view and the API, its tests and the front end never notice. The views are also the security boundary: the managed identity is granted the views, not the tables. Versioning the name means a breaking change ships as `v2` alongside `v1` rather than as a coordinated release.

**Consequence.** Every schema change costs a view edit. That is the point.

### AD-4 · Telemetry and configuration are different things, stored differently

**Decision.** Measurements and **reference data** — persona identity and display, the per-persona app contract, tasks automated, onboarding days, CPU scores, ticket categories, SLA targets — live in the lakehouse beside the gold tables that join to them. **Business policy** — baselines and pillar weights — and everything the portal writes live in a **SQL database in Fabric**.

**Why.** Reference data is needed by the step 2 gold build (app fit needs the app contract; tickets need the categories), so it must sit where that build can read it, and it changes rarely. Baselines and weights are different: they are policy people argue over and will edit, and the Baselines page is built around changing them. Putting those in the lakehouse would mean a pipeline run to change a number. A SQL database in Fabric is transactional, editable, and mirrors into OneLake so the medallion layer can still join to it.

**Consequence.** Two stores with a clear rule: _does the portal or a policy owner change it?_ SQL database. _Otherwise?_ Lakehouse. It also gives writeback (AD-5) a home it would have needed anyway. The full table list is in the front-end to lakehouse map.

### AD-5 · Writes never touch the lakehouse

**Decision.** `POST /api/persona-changes` and `POST /api/devices/:id/provisioning-requests` write to the SQL database in Fabric.

**Why.** The SQL analytics endpoint is read-only, and the lakehouse discovers Delta changes asynchronously — a row written a second ago may not be queryable yet. Anything needing read-after-write consistency cannot live there.

**Consequence.** Written records reach the analytical layer on the next pipeline run, not instantly. The API reads them back from the SQL database so the user sees their own change immediately.

### AD-6 · Scoring stays in `@pfc/scoring`, shared by browser and API

**Decision.** The Functions app imports the same workspace package the web app uses. Grading rules are never reimplemented in SQL.

**Why.** The Baselines page re-grades the whole fleet in the browser as sliders move. If the API graded differently, the two would disagree the moment a draft baseline was applied. One implementation, one test suite, 518 tests already covering it.

**Consequence.** Aggregations that must be done in SQL for performance need a test proving they agree with the TypeScript.

### AD-7 · One identity spine, resolved once — confirmed by discovery

**Decision.** `intune_device_identity_bridge` resolves `DeviceId` / `EntraDeviceId` / `IntuneManagedDeviceId` / `DefenderDeviceId`, in a single gold view every other view joins to.

**Why.** Discovery settled it: all 5,000 devices join the bridge on `DeviceId` and **none** on `EntraDeviceId`, so `dimdevice.DeviceId` is a separate surrogate. Every bronze telemetry table is keyed on `EntraDeviceId`. Without the bridge, joins return nothing — silently.

**Consequence.** Devices absent from the bridge are invisible to the portal. Coverage is currently 100%, and step 2 asserts it stays that way.

### AD-8 · Pre-aggregate in gold; cache what is still expensive

**Decision.** Aggregates are computed by the gold job into tables, so `vw_api_v1_*` is close to `SELECT *`. The BFF caches reference data hard and aggregates for minutes, with a per-endpoint latency budget that is logged.

**Why.** 881,570 boot events and 7.8 million software rows are not something to touch on a page load. Cold queries and concurrency spikes on the SQL endpoint are real.

**Consequence.** Data is as fresh as the gold job plus the cache window. The portal shows the data's own timestamp so that is visible rather than assumed.

### AD-9 · Entra ID end to end, no secrets

**Decision.** Users sign in to the Static Web App with Entra ID. The Function App reaches Fabric with its managed identity. No connection strings, no client secrets, nothing in app settings to rotate.

**Why.** It is the enterprise baseline and it removes an entire class of incident. Roles (`viewer` / `editor`) gate the two POST endpoints.

**Consequence.** The Fabric tenant must allow service principals to use Fabric APIs, and the identity needs workspace access. Both are admin actions, listed in step 4.

### AD-10 · Tickets come from the endpoint-fix lifecycle, labelled as such

**Decision.** `/api/tickets/summary` and `Device.tickets[]` are sourced from `tbl_brz_epfix_eventlifecycle`, not invented. The portal names the source.

**Why.** There is no ITSM feed, but this is not a weak substitute: 43,017 remediation jobs, of which 7,991 failed and 3,508 escalated to a human across 1,088 devices. An escalation _is_ a support event. It carries `escalationReason` (category), `requestedBy`, `ruleId`, `jobId` and a timeline, which covers most of `FleetTicket`.

**Field mapping.** `id` ← `jobId` · `uid` / `dept` / `pid` ← device's primary user via the spine · `cat` ← `escalationReason` · `short` ← `detail` · `state` / `open` ← latest `eventType` per `jobId` · `ageDays` / `week` ← `timestampUtc` (stored as `varchar`, cast in gold) · `group` ← `agentName`.

**Still missing.** `priority` and `sla` have no source. Priority is derived from outcome — escalated is P2, failed is P3, everything else P4 — and recorded here as a derivation, not a measurement. SLA breach is derived the way an ITSM tool computes it — ticket age against a resolution target for its priority — using stated targets in `dimslatarget`, since the contract's `sla` field is a boolean and cannot say "unknown".

**Requests tab.** `kind=req` maps to `tbl_brz_intune_app_deployment` (assignment intent and install state) — application requests, the nearest equivalent to the wireframe's service requests. Confirmed in step 8.

**Consequence.** The Tickets page measures automated-remediation load, not service-desk load. The page says so. If an ITSM source is ingested later, only the gold view changes.

### AD-11 · The API contract is frozen

**Decision.** `apps/web/src/api/types.ts` does not change in this phase. The mock handlers stay in the repository as the reference implementation and the test oracle.

**Why.** The front end is finished, tested and deployed. If the contract holds, the cutover is a configuration flag, and any difference between mock and live is a failing test rather than a bug report.

**Consequence.** Where Fabric cannot fill a field, the BFF supplies a documented, honest default rather than dropping the field. `PersonaId` is already `string`, so a six-persona estate needs no type change.

### AD-12 · We own the gold layer

**Decision.** A Fabric notebook, on a schedule, aggregates bronze telemetry into `factdevicemetrics`, `dimpersona`, `factticket` and `facttitlemapping`. The BFF reads views over those tables and nothing else.

**Why.** `fact_device_score_daily` and `fact_device_metric_daily` are empty, so there is no pre-computed score to consume. The measures exist — boot, crash, battery, disk, patch, compliance — but only as raw events. Something must reduce 881,570 boot events to one number per device, and doing it per request (AD-8) is not an option.

**Consequence.** The backend phase now includes data engineering, not just API work. If the DEX scoring pipeline that populates those fact tables is meant to run, we should know before building a parallel one — open question 12.

### AD-13 · `installed[]` is filtered to the catalogue

**Decision.** The device payload lists only applications in the persona app catalogue, not everything detected.

**Why.** 7.8 million software rows across 5,000 devices is roughly 1,560 entries each. Returning them whole would make `/api/fleet/devices` tens of megabytes and tell the user nothing — the page only ever compares installed apps against the persona's expected set.

**Consequence.** The Device page shows catalogue coverage, not a full software inventory. A full inventory, if wanted later, is its own endpoint.

### AD-14 · Synthetic data is labelled, not filtered

**Decision.** Gold views do not filter `IsSynthetic`. The portal displays that the estate is synthetic.

**Why.** Every row in every table is flagged synthetic — filtering it leaves an empty portal. But a dashboard that looks like a real fleet and is not, without saying so, is exactly the failure AD-10 exists to prevent.

**Consequence.** When real tenant data arrives alongside synthetic, the views gain a filter and the label becomes conditional. Designed for now, not retrofitted.

### AD-15 · The persona set comes from the data

**Decision.** Personas are whatever `dimuser.Persona` contains. The configuration store supplies display name, subtitle, colour and baseline per persona key, and flags any key it does not recognise.

**Why.** The estate has six personas, one of which (Retail) the portal has never seen, and lacks two it was designed around. Hardcoding seven would have broken on the first query.

**Consequence.** A new persona appearing in `dimuser` renders immediately with a neutral colour and a default baseline, and is reported as needing configuration rather than silently mis-graded.

### AD-16 · Mapping confidence measures app fit, not title consistency

**Decision.** Confidence is the degree to which a user's device actually looks like their persona: the share of the persona's expected applications present, penalised by applications characteristic of a different persona, weighted by telemetry coverage.

**Why.** The original plan derived confidence from how consistently a job title maps to one persona. Discovery killed it: all 21 titles map to exactly one persona, so every score would be 100. The app-fit measure uses data we have in abundance (7.8 million software rows) and answers the question the page actually asks — is this person in the right persona?

**Consequence.** `why` becomes a real sentence ("4 of 6 Engineering applications missing; 3 Retail applications present") rather than a stored label. It also means confidence measures something different from a mapping model's own confidence, and the page copy should say which. The score and sentence are stored in `facttitlemapping.ConfidenceScore` and `FlagReason` (AD-17).

### AD-17 · One source lakehouse, grown step by step

**Decision.** The first lakehouse is the single source. Tables and columns the portal needs are added to it as each step requires them — never up front, never in a second lakehouse. New gold tables follow the naming and shapes of the abandoned `vw_landing_*` design: `dimpersona`, `facttitlemapping`, `factdevicemetrics`, `factticket`.

**Why.** The second lakehouse offers nothing the first lacks except two network tables the portal does not use, and its views point at tables that no longer exist. Two sources would mean two answers to every question. The borrowed names match the lakehouse's existing lowercase `dim*` / `fact*` convention (`dimuser`, `dimdevice`), and the borrowed column shapes already match the API contract.

**How changes are made.** The SQL analytics endpoint cannot create or alter tables. Each step supplies a **PySpark notebook cell** for every table it adds or changes, **T-SQL** for every view, and a **check query** that must pass before the step moves on. Every script is committed under `sql/` and `notebooks/`, so the lakehouse can be rebuilt from the repository.

**Consequence.** `dimpersona` holds persona identity and display (key, name, subtitle, colour, order) in the lakehouse; editable policy — baselines and weights — stays in the SQL database (AD-4). The network tables stay available if a connectivity measure is wanted later.

### AD-18 · Five layers between a column name and the front end

**Decision.** A rename or drop anywhere in Fabric is stopped before it reaches the browser, by five layers, each owning one kind of change:

1. **Notebook input check.** The gold notebook asserts every bronze and `dim*` column it reads — name and type — before writing, and fails naming the column. Delta writes are atomic, so gold stays at its last good version and the portal serves slightly older data, with the freshness label showing its age.
2. **Views read only tables we own.** `vw_api_v1_*` views read gold tables built by our notebook, never `dimuser`, `dimdevice` or bronze; the notebook copies what it needs. Every output column is aliased to a stable name. A breaking change ships as a `v2` view beside `v1` (AD-3).
3. **One mapper per endpoint, validated at runtime.** SQL column names appear in exactly one file per endpoint, and every row is validated against a `zod` schema before it becomes JSON — a missing column is a clear error naming the field, never a silent `undefined` that the scoring would grade as zero.
4. **Frozen contract, enforced in CI.** `types.ts` does not change (AD-11); contract tests run the mock API's assertions against the live API and block the deploy on any difference.
5. **Daily drift check.** A scheduled job compares each view's columns with the expected list and runs a trial query, so a change made upstream between deploys is reported before users meet it.

**Why.** The ingestion pipelines own bronze and the `dim*` tables and can change them without notice. The six `vw_landing_*` views in the second lakehouse are the proof: their tables disappeared and they failed silently. Under this design the rebuild would have stopped naming the missing table, the drift check would have flagged the views next morning, and the portal would have kept its last good data.

**Consequence.** The front end knows only `/api/*` and `types.ts`; a Fabric rename costs, at most, one notebook or view edit. The notebook carries a copy of the `dimuser` / `dimdevice` columns it uses, refreshed each run.

---

## Front-end to lakehouse map

Every field the portal reads, where it comes from, and what has to be built. This is the checklist for steps 2–9: each step names the rows it completes.

**Legend:** ✅ exists — read as is · 🔧 exists — derived in gold · ➕ new table or column to create · ⏸ new, starts empty and fills over time

**Existing tables are never altered.** Bronze tables and the existing `dim*` tables belong to the ingestion pipelines, which would overwrite any column we added. Everything the portal needs that the lakehouse lacks goes into a **new** table. The answer to "which existing tables need new columns" is therefore _none_ — every ➕ below is a new table.

**Where new tables live.** Reference data and gold tables go in the **lakehouse**, beside the tables they join to, so the step 2 build can use them. Business policy (baselines, weights) and everything the portal **writes** go in the **SQL database in Fabric** (AD-4, AD-5).

### At a glance

`useFleetModel` combines personas, baselines, devices, migrations and exceptions, so those five endpoints feed **every** page.

| Endpoint                                      | Used by                            | Status | Built from                                                                                    |
| --------------------------------------------- | ---------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `GET /api/personas`                           | every page                         | 🟡     | `dimuser` ✅ · `dimpersona` ➕                                                                |
| `GET /api/baselines`                          | every page                         | 🔴     | `cfg_persona_policy` ➕                                                                       |
| `GET /api/fleet/devices`                      | every page                         | 🟡     | `dimdevice` ✅ · `dimuser` ✅ · `factdevicemetrics` ➕ · `factdeviceapp` ➕ · `factticket` ➕ |
| `GET /api/change/migrations`                  | every page                         | ⏸      | `factpersonasnapshot` ➕ · `persona_change` ➕                                                |
| `GET /api/change/exceptions`                  | every page                         | ⏸      | `app_exception` ➕                                                                            |
| `GET /api/catalog`                            | Persona, Device, Baselines, Switch | 🔴     | `dimpersona` ➕ · `dimpersonaapp` ➕ · `dimticketcategory` ➕                                 |
| `GET /api/mapping/summary`                    | Personas                           | 🔴     | `facttitlemapping` ➕                                                                         |
| `GET /api/mapping/review`                     | Personas                           | 🔴     | `facttitlemapping` ➕                                                                         |
| `GET /api/tickets/summary`                    | Tickets                            | 🔴     | `factticket` ➕                                                                               |
| `GET /api/persona-changes`                    | Switch                             | ⏸      | `persona_change` ➕                                                                           |
| `POST /api/persona-changes`                   | Switch                             | ⏸      | writes `persona_change` ➕                                                                    |
| `POST /api/devices/:id/provisioning-requests` | Device                             | ⏸      | writes `provisioning_request` ➕                                                              |

🟡 part exists · 🔴 nothing exists yet · ⏸ a workflow table that starts empty.

### Field by field

#### `PersonaDef` — `/api/personas`

| Field   | Source                                                                               | Status |
| ------- | ------------------------------------------------------------------------------------ | ------ |
| `id`    | `dimpersona.PersonaKey`                                                              | ➕     |
| `name`  | `dimpersona.PersonaName`                                                             | ➕     |
| `sub`   | `dimpersona.PersonaSubtitle`                                                         | ➕     |
| `hue`   | `dimpersona.HexColour`                                                               | ➕     |
| `count` | `COUNT(*)` of `dimuser`, joined on `dimuser.Persona = dimpersona.SourcePersonaValue` | ✅     |

#### `Baseline` and `Weights` — `/api/baselines`

| Field                                                                                     | Source                                    | Status |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ------ |
| `ramGB` `storageGB` `cpuScore` `bootSec` `crashes` `freePct` `batteryPct` `ticketsPer100` | `cfg_persona_policy`, one row per persona | ➕     |
| `prov` `perf` `comp` `exp` `sup`                                                          | `cfg_persona_policy`                      | ➕     |

#### `CatalogResponse` — `/api/catalog`

| Field              | Source                                   | Status |
| ------------------ | ---------------------------------------- | ------ |
| `apps`             | `dimpersonaapp`, grouped by persona      | ➕     |
| `tasksAutomated`   | `dimpersona.TasksAutomatedPerWeek`       | ➕     |
| `onboardingDays`   | `dimpersona.OnboardingDays`              | ➕     |
| `ticketCategories` | `dimticketcategory` where `Kind = 'inc'` | ➕     |
| `catalogItems`     | `dimticketcategory` where `Kind = 'req'` | ➕     |

#### `Device` — `/api/fleet/devices`

| Field        | Source                                                                                                                                                                                                               | Status |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `id`         | `dimdevice.DeviceId`                                                                                                                                                                                                 | ✅     |
| `host`       | `dimdevice.DeviceName`                                                                                                                                                                                               | ✅     |
| `user`       | `dimdevice.PrimaryUserDisplayName`                                                                                                                                                                                   | ✅     |
| `email`      | `dimuser.EmailId` via `dimdevice.PrimaryUserId`                                                                                                                                                                      | ✅     |
| `site`       | `dimuser.OfficeLocation` (fallback `dimdevice.LocationRegion`)                                                                                                                                                       | ✅     |
| `model`      | `dimdevice.DeviceModel`                                                                                                                                                                                              | ✅     |
| `ramGB`      | `dimdevice.RAM_GB`                                                                                                                                                                                                   | ✅     |
| `storageGB`  | `dimdevice.SSD_GB`                                                                                                                                                                                                   | ✅     |
| `osBuild`    | `dimdevice.OSBuild`, formatted as `Win11 24H2` / `Win10 22H2` — the compliance pillar tests for a `Win11` prefix ([device.ts:21](packages/scoring/src/device.ts#L21)), so a raw build number would fail every device | 🔧     |
| `freePct`    | `factdevicemetrics.FreePct` ← `intune_dim_managed_device` free ÷ total storage                                                                                                                                       | 🔧     |
| `bootSec`    | `factdevicemetrics.BootSec` ← median `tbl_brz_bootperf_event.MainPathBootTimeMs`, 30 days                                                                                                                            | 🔧     |
| `crashes`    | `factdevicemetrics.Crashes30d` ← `tbl_brz_crashdiag_bsod` + `_abnormal` events, 30 days                                                                                                                              | 🔧     |
| `batteryPct` | `factdevicemetrics.BatteryHealthPct` ← latest `tbl_brz_hf_battery.HealthPercent`; null on desktops                                                                                                                   | 🔧     |
| `patched`    | `factdevicemetrics.IsPatched` ← latest `tbl_brz_intune_windows_update_status`                                                                                                                                        | 🔧     |
| `lastSeen`   | `factdevicemetrics.LastSeenDays` ← days since `intune_dim_managed_device.LastSyncDateTime`                                                                                                                           | 🔧     |
| `cpuScore`   | `dimcpumodel.CpuScore` via `dimdevice.CPUModel`                                                                                                                                                                      | ➕     |
| `installed`  | `factdeviceapp`, catalogue apps only (AD-13)                                                                                                                                                                         | ➕     |
| `tickets`    | `factticket` where `Kind = 'inc'`, by device                                                                                                                                                                         | ➕     |

#### `DeviceTicket` and `FleetTicket` — devices and `/api/tickets/summary`

| Field            | Source                                                                          | Status |
| ---------------- | ------------------------------------------------------------------------------- | ------ |
| `number` / `id`  | `factticket.TicketId` ← epfix `jobId`                                           | ➕     |
| `pid`            | `factticket.PersonaKey` via the device's primary user                           | ➕     |
| `uid` `dept`     | `factticket.UserId`, `Department` ← `dimuser`                                   | ➕     |
| `cat`            | `factticket.Category` ← `escalationReason`, matched through `dimticketcategory` | ➕     |
| `short`          | `factticket.ShortDescription` ← `detail`                                        | ➕     |
| `priority`       | `factticket.Priority` — derived from outcome (AD-10)                            | ➕     |
| `state` `open`   | `factticket.State`, `IsOpen` ← latest `eventType` per job                       | ➕     |
| `group`          | `factticket.AssignmentGroup` ← `agentName`                                      | ➕     |
| `ageDays` `week` | `factticket.OpenedUtc` ← `timestampUtc` (text, cast in gold)                    | ➕     |
| `sla`            | `factticket.IsSlaBreached` ← age against `dimslatarget` for its priority        | ➕     |

#### `TitleRow` and `MappingSummary` — `/api/mapping/*`

| Field                                                                        | Source                                                              | Status |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| `t` `dept` `pid`                                                             | `facttitlemapping.JobTitle`, `Department`, `PersonaKey` ← `dimuser` | ➕     |
| `conf`                                                                       | `facttitlemapping.ConfidenceScore` — app fit (AD-16)                | ➕     |
| `why`                                                                        | `facttitlemapping.FlagReason`                                       | ➕     |
| `avgConfidence` `distinctTitles` `titlesMapped` `bands` `byPersona` `byDept` | aggregates of `facttitlemapping`                                    | ➕     |

#### `Migration`, `AppException`, `PersonaChange` — change and switch

| Type            | Source                                                                              | Status |
| --------------- | ----------------------------------------------------------------------------------- | ------ |
| `Migration`     | persona moves between consecutive `factpersonasnapshot` days, plus `persona_change` | ⏸      |
| `AppException`  | `app_exception` — no source exists; empty until the approval workflow is used       | ⏸      |
| `PersonaChange` | `persona_change`                                                                    | ⏸      |
| Provisioning    | `provisioning_request` — returns `number` and `group`                               | ⏸      |

### Build list — tables to create

Types are Spark types for the lakehouse and T-SQL types for the SQL database.

#### Lakehouse — reference tables (step 2)

**`dimpersona`** — one row per persona. Borrowed from the `vw_landing_*` design (AD-17), extended.

| Column                  | Type   | Notes                                              |
| ----------------------- | ------ | -------------------------------------------------- |
| `PersonaKey`            | string | `KW`, `RETAIL`, `CC`, `FIELD`, `DEV`, `EXEC`       |
| `SourcePersonaValue`    | string | The exact text in `dimuser.Persona` — the join key |
| `PersonaName`           | string | Display name                                       |
| `PersonaSubtitle`       | string |                                                    |
| `HexColour`             | string | `#RRGGBB`                                          |
| `SortOrder`             | int    |                                                    |
| `TasksAutomatedPerWeek` | int    | Switch page                                        |
| `OnboardingDays`        | int    | Switch page                                        |

**`dimpersonaapp`** — the per-persona application contract.

| Column         | Type   | Notes                                                                              |
| -------------- | ------ | ---------------------------------------------------------------------------------- |
| `PersonaKey`   | string |                                                                                    |
| `AppName`      | string | Display name shown in the portal                                                   |
| `MatchPattern` | string | `LIKE` pattern against `tbl_brz_systeminfo_software.Name`, which uses vendor names |
| `SortOrder`    | int    |                                                                                    |

**`dimcpumodel`** — five rows, one per `dimdevice.CPUModel`.

| Column     | Type   | Notes                                 |
| ---------- | ------ | ------------------------------------- |
| `CPUModel` | string | Exact value from `dimdevice.CPUModel` |
| `CpuScore` | int    | 0–100, relative performance           |
| `Basis`    | string | Where the score came from, for audit  |

Seed values. The model names carry only a core count — no vendor or generation — so the score is relative multi-core capacity and says so in `Basis`. Only the order matters for fit (baselines sit exactly on a tier, see the seed values below); the gaps set partial credit in the provisioning pillar.

| `CPUModel`        | `CpuScore` | Ships with     |
| ----------------- | ---------- | -------------- |
| `Windows 4-core`  | 35         | 8 GB · 256 GB  |
| `Windows 6-core`  | 45         | 8 GB · 256 GB  |
| `Windows 8-core`  | 60         | 16 GB · 512 GB |
| `Windows 10-core` | 72         | 16 GB · 512 GB |
| `Windows 12-core` | 88         | 32 GB · 1 TB   |

**`dimticketcategory`** — portal categories and how source values map to them.

| Column         | Type   | Notes                                                      |
| -------------- | ------ | ---------------------------------------------------------- |
| `Kind`         | string | `inc` or `req`                                             |
| `CategoryName` | string | e.g. `Performance`, `Storage Upgrade`                      |
| `MatchValue`   | string | Source value mapped here (`escalationReason` / app intent) |
| `SortOrder`    | int    | Drives chart colour order                                  |

**`dimslatarget`** — makes `sla` a derivation from a stated target, not a guess.

| Column        | Type   | Notes             |
| ------------- | ------ | ----------------- |
| `Priority`    | string | `P1`–`P4`         |
| `TargetHours` | int    | Resolution target |

#### Lakehouse — gold tables (step 2)

**`factdevicemetrics`** — one row per device per snapshot date. No stored scores (AD-6).

| Column             | Type    | Notes                                                  |
| ------------------ | ------- | ------------------------------------------------------ |
| `SnapshotDate`     | date    |                                                        |
| `DeviceId`         | string  | `dimdevice.DeviceId`                                   |
| `EntraDeviceId`    | string  | Via the identity bridge (AD-7)                         |
| `PersonaKey`       | string  | Via primary user → `dimpersona`                        |
| `FreePct`          | double  |                                                        |
| `BootSec`          | double  | Median, 30 days                                        |
| `Crashes30d`       | int     |                                                        |
| `BatteryHealthPct` | double  | Null when no battery — never zero                      |
| `IsPatched`        | boolean |                                                        |
| `LastSeenDays`     | int     |                                                        |
| `MissingMeasures`  | string  | Comma list of measures with no telemetry, for coverage |

**`factdeviceapp`** — catalogue applications found on each device (AD-13).

| Column          | Type   | Notes                                                    |
| --------------- | ------ | -------------------------------------------------------- |
| `DeviceId`      | string |                                                          |
| `PersonaKey`    | string | The device's persona                                     |
| `AppName`       | string | `dimpersonaapp.AppName`                                  |
| `AppPersonaKey` | string | Which persona's catalogue it belongs to — powers app fit |

**`factticket`** — one row per ticket; incidents from the epfix lifecycle, requests from app deployment.

| Column             | Type      | Notes                   |
| ------------------ | --------- | ----------------------- |
| `TicketId`         | string    | epfix `jobId`           |
| `Kind`             | string    | `inc` / `req`           |
| `DeviceId`         | string    |                         |
| `UserId`           | string    |                         |
| `PersonaKey`       | string    |                         |
| `Department`       | string    |                         |
| `Category`         | string    | Via `dimticketcategory` |
| `ShortDescription` | string    |                         |
| `Priority`         | string    | Derived (AD-10)         |
| `State`            | string    | Latest lifecycle state  |
| `IsOpen`           | boolean   |                         |
| `AssignmentGroup`  | string    |                         |
| `OpenedUtc`        | timestamp |                         |
| `ClosedUtc`        | timestamp | Null while open         |
| `IsSlaBreached`    | boolean   | Age vs `dimslatarget`   |

**`facttitlemapping`** — one row per job title × department. Borrowed shape (AD-17).

| Column            | Type   | Notes                                                         |
| ----------------- | ------ | ------------------------------------------------------------- |
| `JobTitle`        | string |                                                               |
| `Department`      | string |                                                               |
| `PersonaKey`      | string |                                                               |
| `PersonaName`     | string |                                                               |
| `UserCount`       | int    |                                                               |
| `ConfidenceScore` | int    | 0–100, app fit (AD-16)                                        |
| `FlagReason`      | string | e.g. "4 of 6 Engineering apps missing; 3 Retail apps present" |

**`factpersonasnapshot`** — daily copy of every user's persona; the source of migration history.

| Column         | Type   | Notes |
| -------------- | ------ | ----- |
| `SnapshotDate` | date   |       |
| `UserId`       | string |       |
| `PersonaKey`   | string |       |

#### SQL database in Fabric — policy and writeback (steps 5 and 9)

**`cfg_persona_policy`** — baseline and weights, one row per persona.

| Column                                                                                    | Type               |
| ----------------------------------------------------------------------------------------- | ------------------ |
| `PersonaKey`                                                                              | varchar(16)        |
| `RamGB` `StorageGB` `CpuScore` `BootSec` `Crashes` `FreePct` `BatteryPct` `TicketsPer100` | int                |
| `WeightProv` `WeightPerf` `WeightComp` `WeightExp` `WeightSup`                            | int (sum 100)      |
| `UpdatedBy` `UpdatedUtc`                                                                  | varchar, datetime2 |

**`persona_change`** — `ChangeId`, `UserId`, `DeviceId`, `FromPersonaKey`, `ToPersonaKey`, `RequestedBy` (from Entra, never the request body), `RequestedUtc`, `IdempotencyKey` (unique).

**`provisioning_request`** — `RequestNumber`, `DeviceId`, `AssignmentGroup`, `Status`, `RequestedBy`, `RequestedUtc`, `IdempotencyKey` (unique).

**`app_exception`** — `ExceptionId`, `UserId`, `PersonaKey`, `AppName`, `Reason`, `State` (`Pending` / `Approved` / `Rejected`), `RaisedUtc`, `DecidedBy`, `DecidedUtc`.

### Persona seed values

RAM, storage and CPU are **calibrated against the fleet** (18 Sep 2026, [sql/discovery.sql](sql/discovery.sql) block 9). All other values reuse the wireframe's, except Retail, which is new. **Adopted 18 Sep 2026**; changeable until step 5 seeds `cfg_persona_policy`.

| Key      | `dimuser.Persona` | Name             | Tier    | RAM | Storage | CPU | Boot s | Crashes | Free % | Battery % | Tickets/100 | Weights prov·perf·comp·exp·sup | Tasks/wk | Onboard days | Colour    |
| -------- | ----------------- | ---------------- | ------- | --- | ------- | --- | ------ | ------- | ------ | --------- | ----------- | ------------------------------ | -------- | ------------ | --------- |
| `KW`     | Knowledge Worker  | Knowledge Worker | 8-core  | 16  | 512     | 60  | 45     | 3       | 15     | 70        | 9           | 20·20·25·15·20                 | 8        | 1            | `#2FA9C9` |
| `RETAIL` | Retail            | Retail           | 6-core  | 8   | 256     | 45  | 40     | 2       | 15     | 80        | 12          | 15·25·25·15·20                 | 7        | 1            | `#9B5FE0` |
| `CC`     | Call Centre       | Contact Centre   | 8-core  | 16  | 512     | 60  | 50     | 3       | 15     | 65        | 14          | 20·25·20·10·25                 | 11       | 1            | `#22A57F` |
| `FIELD`  | Field Services    | Field Engineer   | 8-core  | 16  | 512     | 60  | 45     | 3       | 18     | 80        | 16          | 20·15·20·30·15                 | 6        | 4            | `#D98429` |
| `DEV`    | Engineering       | Engineering      | 12-core | 32  | 1024    | 88  | 40     | 2       | 20     | 75        | 12          | 30·30·15·10·15                 | 14       | 3            | `#6E7BF2` |
| `EXEC`   | Executive         | Executive        | 10-core | 16  | 512     | 72  | 35     | 1       | 25     | 85        | 6           | 25·25·20·20·10                 | 5        | 2            | `#C4649B` |

**Why every baseline sits exactly on a tier.** The fleet has five fixed configurations, and RAM and SSD always move together. `fitClass` ([fit.ts:20](packages/scoring/src/fit.ts#L20)) calls a device _fit_ only when it is not above the baseline on any part — so a baseline between tiers, like the wireframe's CPU 55 for Knowledge Worker, leaves **zero** fit devices. It also means a device one tier down is below on RAM _and_ SSD at once, so it lands in _critical_, not _under_; _under_ appears only where two tiers share RAM and SSD and differ on CPU.

**Resulting fit, per persona:**

| Persona          | Devices | Critical    | Under      | Fit         | Over        |
| ---------------- | ------- | ----------- | ---------- | ----------- | ----------- |
| Knowledge Worker | 1,542   | 362 (23.5%) | 0          | 640 (41.5%) | 540 (35.0%) |
| Retail           | 1,115   | 0           | 103 (9.2%) | 167 (15.0%) | 845 (75.8%) |
| Contact Centre   | 812     | 185 (22.8%) | 0          | 337 (41.5%) | 290 (35.7%) |
| Field Engineer   | 780     | 193 (24.7%) | 0          | 299 (38.3%) | 288 (36.9%) |
| Engineering      | 546     | 429 (78.6%) | 0          | 117 (21.4%) | 0           |
| Executive        | 205     | 51 (24.9%)  | 89 (43.4%) | 30 (14.6%)  | 35 (17.1%)  |

**Engineering stays at 32 GB; Executive moves to 16 GB.** A baseline states what the work needs, never what makes a chart look balanced — choosing one to soften the result would be inventing a number (AD-10). Engineering runs Docker Desktop, WSL2 and IntelliJ side by side, for which 32 GB is the enterprise norm; it must be the full 12-core tier, because 32 GB ships with nothing else. The stark result — four in five engineers critically short, while three-quarters of Retail is over-provisioned — is exactly the tour's claim that over-provisioning and critical mismatch land on different personas. Executive work (Office, Power BI, board portal) does not need a workstation; 16 GB on the 10-core tier keeps the wireframe's CPU intent (70 → 72). An earlier draft moved Engineering to 16 GB for a readable chart; that was reversed for the reason above.

**The finding this data will show.** Hardware has been allocated with no regard to persona: every persona, Retail included, has about a fifth of its people on 32 GB 12-core workstations and a quarter on 8 GB machines. Three-quarters of Retail is over-provisioned — the spend the tour's second act talks about — while a fifth of Engineering is critically short. Baselines for boot time, crashes, free space and battery are calibrated in step 2, once `factdevicemetrics` exists.

**Why these Retail values.** Shop-floor and point-of-sale work is light, so RAM (8 GB) and CPU (6-core) sit below Contact Centre. Tills must be up when the store opens, so boot is tighter (40 s) and crash tolerance lower (2). Handhelds run a full shift off the charger, so battery health is high (80 %). Card payments put tills in PCI DSS scope, so compliance carries more weight (25) and provisioning less (15). High seasonal turnover means one-day onboarding. The colour is Data Science's, which this estate does not have and which already passed the WCAG AA audit in all seven themes.

---

## Step 1 — Data discovery

**Status:** Done, 18 Sep 2026. Results above; queries in [sql/discovery.sql](sql/discovery.sql).

---

## Step 2 — Gold layer build

**Goal:** turn bronze telemetry into the per-device and per-persona tables the API reads (AD-12).

**What we do**

- Reference tables, seeded from notebook cells committed in `notebooks/`: `dimpersona`, `dimpersonaapp`, `dimcpumodel`, `dimticketcategory`, `dimslatarget`.
- A Fabric notebook writing the gold tables: `factdevicemetrics`, `factdeviceapp`, `factticket`, `facttitlemapping` (app-fit confidence, AD-16) and the daily `factpersonasnapshot` that becomes migration history. Columns for every table are in the front-end to lakehouse map.
- The identity spine as a single resolved view, joined by everything else (AD-7).
- An input schema check at the top of the notebook: every bronze and `dim*` column it reads, by name and type; the run fails naming anything missing (AD-18).
- Views read only our gold tables — the notebook copies the `dimuser` and `dimdevice` columns it needs (AD-18).
- `vw_api_v1_*` views over those tables — the only objects the BFF may read (AD-3).
- Scheduled through a Data Factory pipeline, with a run log and freshness timestamp the API can expose.

**Test checkpoint**

- Every view returns rows and its column list matches the TypeScript type it feeds.
- Coverage report: devices in `dimdevice`, resolved through the bridge, with a persona, with each telemetry measure present. 100% spine coverage asserted.
- Re-running the job is idempotent — same inputs, same rows.

---

## Step 3 — Functions app scaffold

**Goal:** an empty API that builds, lints, tests and runs beside the web app locally.

**What we do**

- Add `apps/api`: Azure Functions v4, Node 22, TypeScript strict, in the existing npm workspace.
- Depend on `@pfc/scoring`; add the API's tests to the root Vitest run.
- Local development through the Static Web Apps CLI so the browser sees one origin and `/api` behaves as in production.
- One `GET /api/health` endpoint returning build and dependency status.

**Test checkpoint**

- `npm run dev` serves the web app with the API attached; `/api/health` returns 200.
- `npm run lint`, `npm test` and `npm run build` pass for the whole workspace.

---

## Step 4 — Fabric connection layer

**Goal:** authenticated, pooled, observable access to the lakehouse.

**What we do**

- `mssql` over the SQL analytics endpoint, token from `DefaultAzureCredential` (managed identity in Azure, developer sign-in locally).
- Connection pooling, retry on transient errors, per-query timeout, and timing written to Application Insights.
- A thin `query<T>()` helper that is the only place SQL text is executed — parameterised only, no string concatenation.
- Every row validated against a `zod` schema in its endpoint mapper, so a missing column fails loudly with the field named (AD-18).
- Admin prerequisites completed: tenant setting _Service principals can use Fabric APIs_, workspace access for the identity, grants on the views (AD-3).

**Test checkpoint**

- `/api/health` reports a live Fabric connection and round-trip time.
- A deliberately bad query surfaces as a clean 500 with a correlation id, never a stack trace.

---

## Step 5 — Configuration store

**Goal:** business policy and the writeback tables, in a store we can write to (AD-4).

**What we do**

- Create a SQL database in Fabric with `cfg_persona_policy`, `persona_change`, `provisioning_request` and `app_exception`.
- Calibrate each persona's baseline against the fleet's real distribution ([sql/discovery.sql](sql/discovery.sql) block 9), then seed the six personas from the seed table — including the approved **Retail** values.
- Schema and seed data as versioned SQL in `sql/config/`.

**Test checkpoint**

- Every `dimpersona` key has a `cfg_persona_policy` row, and each row's weights sum to 100.
- No persona has more than an agreed share of devices under baseline purely because a reused wireframe value does not fit this fleet.

---

## Step 6 — Reference endpoints

**Goal:** the small, cacheable payloads. First real data in the browser.

**What we do**

- `GET /api/personas`, `GET /api/baselines`, `GET /api/catalog`, reading the configuration store and persona counts from gold.
- Response shaping isolated in one mapper per endpoint, so the SQL row shape never leaks into the API type.

**Test checkpoint**

- Responses validate against `apps/web/src/api/types.ts`.
- With `VITE_USE_MOCKS=false` the Personas page shows six rings with real headcounts.

---

## Step 7 — Fleet devices endpoint

**Goal:** the largest and most valuable payload — real devices, graded against real baselines.

**What we do**

- `GET /api/fleet/devices` from `vw_api_v1_device`, with `installed[]` filtered to the catalogue (AD-13).
- Grade with `@pfc/scoring` (AD-6). 5,000 devices ship whole; measure the payload and revisit only if it exceeds budget.
- Devices with missing telemetry are marked as such rather than defaulted to zero, so they cannot silently drag a persona's health down.

**Test checkpoint**

- Persona and Device pages render real devices end to end.
- Payload size and response time recorded here; coverage of each measure reported.

---

## Step 8 — Mapping and aggregate endpoints

**Goal:** the confidence story and the aggregate-heavy summaries.

**What we do**

- `GET /api/mapping/summary` and `/api/mapping/review` over the app-fit confidence measure (AD-16), with a generated `why`.
- `GET /api/tickets/summary` from `factticket` (AD-10), honouring the `kind`, persona and category parameters; confirm `tbl_brz_intune_app_deployment` for the requests tab.
- Aggregation in SQL, with a test proving it agrees with the TypeScript aggregation in `apps/web/src/mocks/aggregate.ts`.

**Test checkpoint**

- Mapping bands total the number of mapped titles; review rows respect the 150-row cap.
- Tickets page renders, correctly labelled as to its source (AD-10).

---

## Step 9 — Change endpoints and writeback

**Goal:** the portal stops being read-only.

**What we do**

- `GET /api/change/migrations`, `/api/change/exceptions`, `/api/persona-changes` from the configuration store and the accumulating snapshot history.
- `POST /api/persona-changes` and `POST /api/devices/:id/provisioning-requests`, transactional, idempotent by request key so a double submit creates one record.
- Every write records who made it, from the Entra identity — never from the request body.

**Test checkpoint**

- Switch page applies a persona change and the change log shows it immediately (AD-5).
- The same request sent twice creates one record and returns the same response.

---

## Step 10 — Auth, caching and performance

**Goal:** make it fast enough and safe enough to put in front of the business.

**What we do**

- Entra ID sign-in on the Static Web App; `viewer` and `editor` roles, with POST restricted to `editor`.
- Per-endpoint cache policy and latency budget (AD-8); cache headers tuned alongside the existing `staticwebapp.config.json`.
- Load test at expected concurrency; Application Insights dashboard for latency, errors and Fabric query time.
- The portal displays data freshness from the gold run log, and the synthetic-data label (AD-14).

**Test checkpoint**

- An anonymous request is rejected; a `viewer` cannot POST; an `editor` can.
- Every endpoint inside its budget at target concurrency, with numbers recorded here.

---

## Step 11 — Contract tests, cutover and deploy

**Goal:** switch the portal to live data with the safety net phase one established.

**What we do**

- A contract test suite that runs the mock handlers' assertions against the live API, so mock and Fabric cannot drift.
- A daily drift check: each view's columns compared with the expected list, plus a trial query per view (AD-18).
- Fix the guided tour's `pid: "DS"` reference ([steps.ts:85](apps/web/src/tour/steps.ts#L85)) to a persona this estate has.
- `VITE_USE_MOCKS=false`; mocks stay in the repository for tests and local work.
- Extend the CI workflow with `api_location`; capture the Function App, SQL database and role assignments as Bicep in `infra/`.
- Re-run the 45-step smoke test and the layout and accessibility audit against the API-backed site.

**Test checkpoint**

- CI green through deploy: lint, test, contract tests, build, smoke, audit.
- The live site serves Fabric data on every page, with the tour still passing end to end.

---

## Open questions

Answered items keep their evidence. Queries are in [sql/discovery.sql](sql/discovery.sql).

| #   | Question                                                         | Answer                                                                              |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Devices whole or paginated?                                      | ✅ Whole — 5,000 devices, with `installed[]` filtered (AD-13)                       |
| 2   | Synthetic, real or mixed?                                        | ✅ Entirely synthetic — labelled, not filtered (AD-14)                              |
| 3   | Do persona values match the portal's seven?                      | ✅ No — six, including a new Retail persona (AD-15)                                 |
| 4   | Is consistency-based mapping confidence viable?                  | ✅ No — all 21 titles map to one persona; replaced by app fit (AD-16)               |
| 5   | Is `dimdevice.DeviceId` the Entra device id?                     | ✅ No — bridge required, 100% coverage (AD-7)                                       |
| 6   | Days of `fact_device_score_daily` history?                       | ✅ None — table empty (AD-12)                                                       |
| 7   | What is in `fact_device_metric_daily.MetricKey`?                 | ✅ Nothing — table empty (AD-12)                                                    |
| 8   | Is the endpoint-fix lifecycle a usable ticket substitute?        | ✅ Yes — 3,508 escalations, 7,991 failures, with reason and requester (AD-10)       |
| 9   | Is there a ServiceNow (or equivalent) source to ingest?          | Open                                                                                |
| 10  | Subscription and resource group — `Shashi-RG`, Central India?    | Open                                                                                |
| 11  | Entra sign-in required, and which group gets `editor`?           | Open                                                                                |
| 12  | **Is a DEX scoring pipeline meant to populate the fact tables?** | Open — decides whether step 2 builds gold or waits for it                           |
| 13  | **What baseline should the Retail persona have?**                | ✅ 8 GB · 256 GB · 6-core; all six baselines adopted 18 Sep 2026                    |
| 14  | Is `tbl_brz_intune_app_deployment` the right requests source?    | Open — confirmed in step 8                                                          |
| 15  | Which lakehouse is the source?                                   | ✅ The first; the second differs only by two unused tables and broken views (AD-17) |
