/*
  Persona Fleet Command — lakehouse discovery queries
  ---------------------------------------------------
  Run these against the lakehouse SQL analytics endpoint (read-only T-SQL).
  Paste the result of each block back; together they decide the gold view
  design in backend.md step 1.

  Safe to run: every statement is a SELECT.
*/

-- ---------------------------------------------------------------------------
-- 1 · Row counts — decides whether /api/fleet/devices ships whole or paginated
-- ---------------------------------------------------------------------------
SELECT 'dimuser' AS TableName, COUNT(*) AS RowsTotal FROM dbo.dimuser
UNION ALL SELECT 'dimdevice', COUNT(*) FROM dbo.dimdevice
UNION ALL SELECT 'fact_device_score_daily', COUNT(*) FROM dbo.fact_device_score_daily
UNION ALL SELECT 'fact_device_metric_daily', COUNT(*) FROM dbo.fact_device_metric_daily
UNION ALL SELECT 'intune_device_identity_bridge', COUNT(*) FROM dbo.intune_device_identity_bridge
UNION ALL SELECT 'intune_dim_managed_device', COUNT(*) FROM dbo.intune_dim_managed_device
UNION ALL SELECT 'tbl_brz_bootperf_event', COUNT(*) FROM dbo.tbl_brz_bootperf_event
UNION ALL SELECT 'tbl_brz_crashdiag', COUNT(*) FROM dbo.tbl_brz_crashdiag
UNION ALL SELECT 'tbl_brz_hf_battery', COUNT(*) FROM dbo.tbl_brz_hf_battery
UNION ALL SELECT 'tbl_brz_hf_disk_volume', COUNT(*) FROM dbo.tbl_brz_hf_disk_volume
UNION ALL SELECT 'tbl_brz_systeminfo', COUNT(*) FROM dbo.tbl_brz_systeminfo
UNION ALL SELECT 'tbl_brz_systeminfo_software', COUNT(*) FROM dbo.tbl_brz_systeminfo_software
UNION ALL SELECT 'tbl_brz_intune_windows_update_status', COUNT(*) FROM dbo.tbl_brz_intune_windows_update_status
UNION ALL SELECT 'tbl_brz_epfix_eventlifecycle', COUNT(*) FROM dbo.tbl_brz_epfix_eventlifecycle
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 2 · Synthetic vs real — decides whether the gold views filter IsSynthetic
-- ---------------------------------------------------------------------------
SELECT 'intune_dim_managed_device' AS TableName, IsSynthetic, COUNT(*) AS RowsTotal
FROM dbo.intune_dim_managed_device GROUP BY IsSynthetic
UNION ALL
SELECT 'intune_dim_entra_device', IsSynthetic, COUNT(*)
FROM dbo.intune_dim_entra_device GROUP BY IsSynthetic
UNION ALL
SELECT 'tbl_brz_entra_user', IsSynthetic, COUNT(*)
FROM dbo.tbl_brz_entra_user GROUP BY IsSynthetic
UNION ALL
SELECT 'intune_fact_device_compliance', IsSynthetic, COUNT(*)
FROM dbo.intune_fact_device_compliance GROUP BY IsSynthetic
UNION ALL
SELECT 'intune_dim_data_source', IsSynthetic, COUNT(*)
FROM dbo.intune_dim_data_source GROUP BY IsSynthetic
ORDER BY 1, 2;


-- ---------------------------------------------------------------------------
-- 3a · Personas — do they match the seven the portal is built around?
-- ---------------------------------------------------------------------------
SELECT
    Persona,
    COUNT(*)                                     AS Users,
    SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveUsers,
    COUNT(DISTINCT Department)                   AS Departments,
    COUNT(DISTINCT JobTitle)                     AS JobTitles
FROM dbo.dimuser
GROUP BY Persona
ORDER BY Users DESC;

-- 3b · Can mapping confidence be derived? (how consistently a title maps to one persona)
SELECT
    COUNT(*)                                          AS DistinctTitles,
    SUM(CASE WHEN PersonaCount = 1 THEN 1 ELSE 0 END) AS TitlesWithOnePersona,
    SUM(CASE WHEN PersonaCount > 1 THEN 1 ELSE 0 END) AS TitlesWithManyPersonas,
    MAX(PersonaCount)                                 AS WorstTitleSpread
FROM (
    SELECT JobTitle, COUNT(DISTINCT Persona) AS PersonaCount
    FROM dbo.dimuser
    WHERE JobTitle IS NOT NULL AND Persona IS NOT NULL
    GROUP BY JobTitle
) t;


-- ---------------------------------------------------------------------------
-- 4 · Identity spine — is dimdevice.DeviceId the Entra device id, and do the
--     dimension and the fact tables cover the same devices?
-- ---------------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM dbo.dimdevice)                              AS Devices,
    (SELECT COUNT(*) FROM dbo.dimdevice d
       JOIN dbo.intune_device_identity_bridge b ON b.DeviceId = d.DeviceId)      AS JoinsOnDeviceId,
    (SELECT COUNT(*) FROM dbo.dimdevice d
       JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = d.DeviceId) AS DeviceIdLooksLikeEntraId,
    (SELECT COUNT(DISTINCT EntraDeviceId) FROM dbo.fact_device_score_daily)      AS ScoredDevices,
    (SELECT COUNT(*) FROM dbo.dimdevice WHERE PrimaryUserId IS NOT NULL)         AS DevicesWithPrimaryUser,
    (SELECT COUNT(*) FROM dbo.dimdevice d
       JOIN dbo.dimuser u ON u.UserId = d.PrimaryUserId)                         AS DevicesJoinedToUser,
    (SELECT COUNT(DISTINCT CPUModel) FROM dbo.dimdevice)                         AS DistinctCpuModels,
    (SELECT COUNT(DISTINCT DeviceModel) FROM dbo.dimdevice)                      AS DistinctDeviceModels;


-- ---------------------------------------------------------------------------
-- 5 · Freshness and history depth
-- ---------------------------------------------------------------------------
SELECT
    MIN(ScoreDate)             AS FirstScoreDate,
    MAX(ScoreDate)             AS LastScoreDate,
    COUNT(DISTINCT ScoreDate)  AS DaysWithData,
    AVG(CAST(NullPillarCount AS float)) AS AvgNullPillars
FROM dbo.fact_device_score_daily;


-- ---------------------------------------------------------------------------
-- 6 · What is actually in the metric fact? (MetricKey is key-value; its
--     contents decide how much we derive vs recompute from bronze)
-- ---------------------------------------------------------------------------
SELECT
    MetricKey,
    COUNT(*)          AS RowsTotal,
    MIN(MetricValue)  AS MinValue,
    MAX(MetricValue)  AS MaxValue
FROM dbo.fact_device_metric_daily
GROUP BY MetricKey
ORDER BY MetricKey;


-- ---------------------------------------------------------------------------
-- 7 · Ticket substitute — what the endpoint-fix lifecycle actually contains
-- ---------------------------------------------------------------------------
SELECT eventType, COUNT(*) AS RowsTotal, COUNT(DISTINCT entraDeviceId) AS Devices
FROM dbo.tbl_brz_epfix_eventlifecycle
GROUP BY eventType
ORDER BY RowsTotal DESC;


-- ===========================================================================
-- 8 · Second lakehouse (EPInsight_Lakehouse_Dev) — existing vw_landing_* views
--     Run each statement on its own; the editor may show only the last result.
-- ===========================================================================

-- 8a · View definitions: where do conf, health, underPct, hue and openTickets come from?
SELECT OBJECT_NAME(m.object_id) AS ViewName, m.definition
FROM sys.sql_modules m
JOIN sys.views v ON v.object_id = m.object_id
ORDER BY 1;

-- 8b · What the views return
SELECT * FROM dbo.vw_landing_persona ORDER BY sortOrder;

SELECT * FROM dbo.vw_landing_confidence_kpi;

SELECT band, COUNT(*) AS RowsTotal, MIN(conf) AS MinConf, MAX(conf) AS MaxConf
FROM dbo.vw_landing_review_rows
GROUP BY band;

-- 8c · Is this the same data as the first lakehouse?
SELECT 'dimuser' AS T, COUNT(*) AS N FROM dbo.dimuser
UNION ALL SELECT 'dimdevice', COUNT(*) FROM dbo.dimdevice
UNION ALL SELECT 'fact_device_score_daily', COUNT(*) FROM dbo.fact_device_score_daily
UNION ALL SELECT 'fact_device_metric_daily', COUNT(*) FROM dbo.fact_device_metric_daily
UNION ALL SELECT 'tbl_brz_epfix_eventlifecycle', COUNT(*) FROM dbo.tbl_brz_epfix_eventlifecycle;

SELECT Persona, COUNT(*) AS Users
FROM dbo.dimuser
GROUP BY Persona
ORDER BY Users DESC;


-- ===========================================================================
-- 9 · Baseline calibration — what each persona's devices actually have.
--     A baseline above this marks the whole persona under-provisioned.
-- ===========================================================================
SELECT
    u.Persona,
    d.RAM_GB,
    d.SSD_GB,
    d.CPUModel,
    COUNT(*) AS Devices
FROM dbo.dimdevice d
JOIN dbo.dimuser u ON u.UserId = d.PrimaryUserId
GROUP BY u.Persona, d.RAM_GB, d.SSD_GB, d.CPUModel
ORDER BY u.Persona, Devices DESC;


-- ===========================================================================
-- 10 · Value discovery for the gold build (step 2b). Run each on its own and
--      paste results as text. Each block says what it decides.
-- ===========================================================================

-- 10a · Time range and bridge coverage of every telemetry source.
--       Decides the "last 30 days" window: it must be anchored to the data's
--       own latest date, not today, or synthetic data may fall outside it.
SELECT 'bootperf_event' AS Source, MIN(EventTimeUtc) AS FirstUtc, MAX(EventTimeUtc) AS LastUtc,
       COUNT(DISTINCT t.EntraDeviceId) AS Devices, COUNT(DISTINCT b.EntraDeviceId) AS MatchedToBridge
FROM dbo.tbl_brz_bootperf_event t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.EntraDeviceId
UNION ALL
SELECT 'crashdiag_bsod', MIN(EventTimeUtc), MAX(EventTimeUtc), COUNT(DISTINCT t.EntraDeviceId), COUNT(DISTINCT b.EntraDeviceId)
FROM dbo.tbl_brz_crashdiag_bsod t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.EntraDeviceId
UNION ALL
SELECT 'crashdiag_abnormal', MIN(EventTimeUtc), MAX(EventTimeUtc), COUNT(DISTINCT t.EntraDeviceId), COUNT(DISTINCT b.EntraDeviceId)
FROM dbo.tbl_brz_crashdiag_abnormal t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.EntraDeviceId
UNION ALL
SELECT 'hf_battery', MIN(SampleTimeUtc), MAX(SampleTimeUtc), COUNT(DISTINCT t.EntraDeviceId), COUNT(DISTINCT b.EntraDeviceId)
FROM dbo.tbl_brz_hf_battery t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.EntraDeviceId
UNION ALL
SELECT 'systeminfo_software', MIN(RecordedAtUtc), MAX(RecordedAtUtc), COUNT(DISTINCT t.EntraDeviceId), COUNT(DISTINCT b.EntraDeviceId)
FROM dbo.tbl_brz_systeminfo_software t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.EntraDeviceId
UNION ALL
SELECT 'epfix_eventlifecycle', MIN(EnqueuedAtUtc), MAX(EnqueuedAtUtc), COUNT(DISTINCT t.entraDeviceId), COUNT(DISTINCT b.EntraDeviceId)
FROM dbo.tbl_brz_epfix_eventlifecycle t LEFT JOIN dbo.intune_device_identity_bridge b ON b.EntraDeviceId = t.entraDeviceId
UNION ALL
SELECT 'managed_device (last sync)', MIN(LastSyncDateTime), MAX(LastSyncDateTime), COUNT(DISTINCT t.DeviceId), COUNT(DISTINCT b.DeviceId)
FROM dbo.intune_dim_managed_device t LEFT JOIN dbo.intune_device_identity_bridge b ON b.DeviceId = t.DeviceId
UNION ALL
SELECT 'windows_update_status', MIN(CAST([Date] AS datetime2)), MAX(CAST([Date] AS datetime2)), COUNT(DISTINCT t.DeviceId), COUNT(DISTINCT b.DeviceId)
FROM dbo.tbl_brz_intune_windows_update_status t LEFT JOIN dbo.intune_device_identity_bridge b ON b.DeviceId = t.DeviceId;

-- 10b · OS values. Decides how osBuild becomes "Win11 24H2" (compliance pillar).
SELECT OperatingSystem, OSVersion, OSBuild, COUNT(*) AS Devices
FROM dbo.dimdevice
GROUP BY OperatingSystem, OSVersion, OSBuild
ORDER BY Devices DESC;

-- 10c · Sites. Decides whether `site` uses OfficeLocation or LocationRegion.
SELECT OfficeLocation, LocationRegion, COUNT(*) AS Users
FROM dbo.dimuser
GROUP BY OfficeLocation, LocationRegion
ORDER BY Users DESC;

-- 10d · Patch state values. Decides what counts as `patched`.
SELECT UpdateStatus, Readiness, COUNT(*) AS RowsTotal, COUNT(DISTINCT DeviceId) AS Devices
FROM dbo.tbl_brz_intune_windows_update_status
GROUP BY UpdateStatus, Readiness
ORDER BY RowsTotal DESC;

-- 10e · Ticket lifecycle: the final state of each remediation job.
--       Decides which jobs count as tickets and how they are prioritised.
WITH ordered AS (
    SELECT jobId, eventType,
           ROW_NUMBER() OVER (PARTITION BY jobId
                              ORDER BY COALESCE(TRY_CAST(timestampUtc AS datetime2), EnqueuedAtUtc) DESC) AS rn
    FROM dbo.tbl_brz_epfix_eventlifecycle
    WHERE eventType <> 'HEARTBEAT'
)
SELECT eventType AS FinalState, COUNT(*) AS Jobs
FROM ordered WHERE rn = 1
GROUP BY eventType
ORDER BY Jobs DESC;

-- 10f · Ticket categories: escalation reasons and the rules that raised them.
--       Decides dimticketcategory.
SELECT escalationReason, COUNT(DISTINCT jobId) AS Jobs
FROM dbo.tbl_brz_epfix_eventlifecycle
WHERE eventType IN ('ESCALATED', 'FAILED')
GROUP BY escalationReason
ORDER BY Jobs DESC;

SELECT TOP 25 ruleId, COUNT(DISTINCT jobId) AS Jobs, MAX(detail) AS SampleDetail
FROM dbo.tbl_brz_epfix_eventlifecycle
WHERE eventType <> 'HEARTBEAT'
GROUP BY ruleId
ORDER BY Jobs DESC;

-- 10g · Timestamp format of the text column (it is varchar in bronze).
SELECT TOP 5 timestampUtc, EnqueuedAtUtc, TRY_CAST(timestampUtc AS datetime2) AS Parsed
FROM dbo.tbl_brz_epfix_eventlifecycle
WHERE eventType = 'ESCALATED';

-- 10h · Requests source: app deployment intents and states.
SELECT AssignmentIntent, InstallState, COUNT(*) AS RowsTotal, COUNT(DISTINCT DeviceId) AS Devices
FROM dbo.tbl_brz_intune_app_deployment
GROUP BY AssignmentIntent, InstallState
ORDER BY RowsTotal DESC;

-- 10i · Software characteristic of each persona. Decides dimpersonaapp.
--       Lists apps on at least 30% of a persona's devices, with the share
--       across the whole fleet for comparison. May take a minute (7.8M rows).
WITH dev AS (
    SELECT b.EntraDeviceId, u.Persona
    FROM dbo.dimdevice d
    JOIN dbo.dimuser u ON u.UserId = d.PrimaryUserId
    JOIN dbo.intune_device_identity_bridge b ON b.DeviceId = d.DeviceId
),
sw AS (SELECT DISTINCT EntraDeviceId, Name FROM dbo.tbl_brz_systeminfo_software),
per AS (
    SELECT dev.Persona, sw.Name, COUNT(*) AS Devices
    FROM sw JOIN dev ON dev.EntraDeviceId = sw.EntraDeviceId
    GROUP BY dev.Persona, sw.Name
),
fleet AS (
    SELECT sw.Name, COUNT(*) AS Devices
    FROM sw JOIN dev ON dev.EntraDeviceId = sw.EntraDeviceId
    GROUP BY sw.Name
),
n AS (SELECT Persona, COUNT(*) AS Total FROM dev GROUP BY Persona)
SELECT per.Persona, per.Name,
       CAST(100.0 * per.Devices / n.Total AS decimal(5, 1))                         AS PctOfPersona,
       CAST(100.0 * fleet.Devices / (SELECT COUNT(*) FROM dev) AS decimal(5, 1))    AS PctOfFleet
FROM per
JOIN n ON n.Persona = per.Persona
JOIN fleet ON fleet.Name = per.Name
WHERE 100.0 * per.Devices / n.Total >= 30
ORDER BY per.Persona, PctOfPersona DESC;
