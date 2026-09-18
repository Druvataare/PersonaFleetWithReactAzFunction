/*
  Persona Fleet Command — API views, version 1 (step 2e)
  -------------------------------------------------------
  The only objects the API may read (AD-3). Each reads persona_ gold and
  reference tables only — never bronze, dimuser or dimdevice (AD-18) — and
  every column is aliased to the name of the TypeScript field it feeds, so the
  API's mappers are near one-to-one.

  Run in the lakehouse SQL analytics endpoint. Safe to re-run: CREATE OR ALTER.
  GO separates batches; if the editor rejects it, run each block on its own.

  Grain, not aggregates: filtering and aggregation (mapping summary, review
  queue, ticket summary) run in the API with the same tested functions the
  mock API uses, so mock and live cannot disagree. The heavy reduction of raw
  telemetry has already happened in notebooks/02d_gold_tables.py.

  A breaking change ships as persona_vw_api_v2_* beside v1, never in place.
*/

-- Freshness: the data's AsOfDate and the latest persona snapshot (AD-8, AD-14).
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_freshness AS
SELECT
    (SELECT MAX(SnapshotDate) FROM dbo.persona_factdevicemetrics)   AS asOfDate,
    (SELECT MAX(SnapshotDate) FROM dbo.persona_factpersonasnapshot) AS personaSnapshotDate;
GO

-- /api/personas (PersonaDef) and the per-persona parts of /api/catalog.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_persona AS
SELECT
    p.PersonaKey            AS id,
    p.PersonaName           AS name,
    p.PersonaSubtitle       AS sub,
    p.HexColour             AS hue,
    COALESCE(h.headcount, 0) AS [count],
    p.SortOrder             AS sortOrder,
    p.TasksAutomatedPerWeek AS tasksAutomated,
    p.OnboardingDays        AS onboardingDays
FROM dbo.persona_dimpersona p
LEFT JOIN (
    SELECT PersonaKey, COUNT(*) AS headcount
    FROM dbo.persona_factpersonasnapshot
    WHERE SnapshotDate = (SELECT MAX(SnapshotDate) FROM dbo.persona_factpersonasnapshot)
    GROUP BY PersonaKey
) h ON h.PersonaKey = p.PersonaKey;
GO

-- /api/catalog → apps: the persona app contract.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_persona_app AS
SELECT PersonaKey AS personaId, AppName AS app, SortOrder AS sortOrder
FROM dbo.persona_dimpersonaapp;
GO

-- /api/catalog → ticketCategories ('inc') and catalogItems ('req', by volume).
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_ticket_category AS
SELECT 'inc' AS kind, CategoryName AS name, SortOrder AS sortOrder
FROM dbo.persona_dimticketcategory
WHERE Kind = 'inc'
UNION ALL
SELECT 'req', Category, CAST(ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, Category) AS int)
FROM dbo.persona_factticket
WHERE Kind = 'req'
GROUP BY Category;
GO

-- /api/fleet/devices → Device, latest snapshot. personaId groups the response.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_device AS
SELECT
    DeviceId         AS id,
    PersonaKey       AS personaId,
    DeviceName       AS host,
    UserDisplayName  AS [user],
    Email            AS email,
    Site             AS site,
    Model            AS model,
    RamGB            AS ramGB,
    StorageGB        AS storageGB,
    FreePct          AS freePct,
    CpuScore         AS cpuScore,
    BootSec          AS bootSec,
    Crashes30d       AS crashes,
    BatteryHealthPct AS batteryPct,
    IsPatched        AS patched,
    OsBuild          AS osBuild,
    LastSeenDays     AS lastSeen,
    MissingMeasures  AS missingMeasures
FROM dbo.persona_factdevicemetrics
WHERE SnapshotDate = (SELECT MAX(SnapshotDate) FROM dbo.persona_factdevicemetrics);
GO

-- Device → tickets (DeviceTicket): incident tickets opened in the last 30 days,
-- the same window ticketsPer100 is measured over (2e calibration).
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_device_ticket AS
SELECT
    DeviceId         AS deviceId,
    TicketId         AS number,
    Category         AS cat,
    ShortDescription AS short,
    Priority         AS priority,
    State            AS state,
    AssignmentGroup  AS [group],
    AgeDays          AS ageDays
FROM dbo.persona_factticket
WHERE Kind = 'inc'
  AND CAST(OpenedUtc AS date) > DATEADD(day, -30, (SELECT MAX(SnapshotDate) FROM dbo.persona_factdevicemetrics));
GO

-- Device → installed: catalogue apps found on the device (AD-13).
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_device_app AS
SELECT DISTINCT DeviceId AS deviceId, AppName AS app
FROM dbo.persona_factdeviceapp;
GO

-- /api/tickets/summary → FleetTicket rows, 12 weeks, both kinds.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_ticket AS
SELECT
    TicketId         AS id,
    Kind             AS kind,
    PersonaKey       AS pid,
    UserId           AS uid,
    Department       AS dept,
    Category         AS cat,
    ShortDescription AS short,
    Priority         AS priority,
    State            AS state,
    IsOpen           AS [open],
    AssignmentGroup  AS [group],
    AgeDays          AS ageDays,
    WeekIndex        AS week,
    IsSlaBreached    AS sla,
    FailureCount     AS failureCount,
    DeviceId         AS deviceId
FROM dbo.persona_factticket
WHERE WeekIndex BETWEEN 0 AND 11;
GO

-- /api/mapping/summary and /api/mapping/review → TitleRow.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_title_mapping AS
SELECT
    JobTitle        AS t,
    Department      AS dept,
    PersonaKey      AS pid,
    ConfidenceScore AS conf,
    FlagReason      AS why,
    UserCount       AS users
FROM dbo.persona_facttitlemapping;
GO

-- /api/change/migrations → Migration: persona moves between consecutive daily
-- snapshots. Empty until a second snapshot exists; portal-made changes
-- (persona_change, SQL database) are added by the API in step 9.
CREATE OR ALTER VIEW dbo.persona_vw_api_v1_migration AS
WITH days AS (
    SELECT DISTINCT SnapshotDate FROM dbo.persona_factpersonasnapshot
),
pairs AS (
    SELECT SnapshotDate AS toDate, LAG(SnapshotDate) OVER (ORDER BY SnapshotDate) AS fromDate
    FROM days
)
SELECT a.PersonaKey AS [from], b.PersonaKey AS [to], COUNT(*) AS people
FROM pairs p
JOIN dbo.persona_factpersonasnapshot a ON a.SnapshotDate = p.fromDate
JOIN dbo.persona_factpersonasnapshot b ON b.SnapshotDate = p.toDate AND b.UserId = a.UserId
WHERE a.PersonaKey <> b.PersonaKey
GROUP BY a.PersonaKey, b.PersonaKey;
GO
