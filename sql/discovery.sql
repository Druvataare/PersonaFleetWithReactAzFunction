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
