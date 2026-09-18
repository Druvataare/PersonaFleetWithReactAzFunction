/*
  Step 2e — calibration figures. Run in the lakehouse SQL analytics endpoint.
  What each persona's devices actually measure, used to set the boot, crash,
  free-space, battery and ticket baselines (as block 9 did for RAM/SSD/CPU).
*/

-- 1 · Per persona: quartiles and rates over the latest snapshot
WITH m AS (
    SELECT * FROM dbo.persona_factdevicemetrics
    WHERE SnapshotDate = (SELECT MAX(SnapshotDate) FROM dbo.persona_factdevicemetrics)
),
pct AS (
    SELECT DISTINCT PersonaKey,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY BootSec)          OVER (PARTITION BY PersonaKey) AS Boot25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY BootSec)          OVER (PARTITION BY PersonaKey) AS Boot50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY BootSec)          OVER (PARTITION BY PersonaKey) AS Boot75,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY FreePct)          OVER (PARTITION BY PersonaKey) AS Free25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY FreePct)          OVER (PARTITION BY PersonaKey) AS Free50,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY BatteryHealthPct) OVER (PARTITION BY PersonaKey) AS Batt25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY BatteryHealthPct) OVER (PARTITION BY PersonaKey) AS Batt50
    FROM m
),
agg AS (
    SELECT PersonaKey, COUNT(*) AS Devices,
           AVG(CAST(Crashes30d AS float))                                 AS AvgCrashes,
           100.0 * AVG(CASE WHEN Crashes30d > 0 THEN 1.0 ELSE 0.0 END)    AS PctWithCrash,
           MAX(Crashes30d)                                                AS MaxCrashes,
           100.0 * AVG(CASE WHEN IsPatched = 1 THEN 1.0 ELSE 0.0 END)     AS PctPatched,
           SUM(CASE WHEN BatteryHealthPct IS NULL THEN 1 ELSE 0 END)      AS NoBattery
    FROM m GROUP BY PersonaKey
),
inc AS (
    SELECT PersonaKey, COUNT(*) AS Incidents30d
    FROM dbo.persona_factticket
    WHERE Kind = 'inc'
      AND CAST(OpenedUtc AS date) > DATEADD(day, -30, (SELECT MAX(SnapshotDate) FROM m))
    GROUP BY PersonaKey
)
SELECT a.PersonaKey, a.Devices,
       CAST(p.Boot25 AS decimal(6,1)) AS Boot25, CAST(p.Boot50 AS decimal(6,1)) AS Boot50,
       CAST(p.Boot75 AS decimal(6,1)) AS Boot75,
       CAST(a.AvgCrashes AS decimal(5,2)) AS AvgCrashes, CAST(a.PctWithCrash AS decimal(5,1)) AS PctWithCrash,
       a.MaxCrashes,
       CAST(p.Free25 AS decimal(5,1)) AS Free25, CAST(p.Free50 AS decimal(5,1)) AS Free50,
       CAST(p.Batt25 AS decimal(5,1)) AS Batt25, CAST(p.Batt50 AS decimal(5,1)) AS Batt50, a.NoBattery,
       CAST(a.PctPatched AS decimal(5,1)) AS PctPatched,
       CAST(100.0 * i.Incidents30d / a.Devices AS decimal(6,1)) AS IncidentsPer100Devices30d
FROM agg a
JOIN pct p ON p.PersonaKey = a.PersonaKey
LEFT JOIN inc i ON i.PersonaKey = a.PersonaKey
ORDER BY a.PersonaKey;

-- 2 · Are open incidents repeats on the same device and rule? If OpenTickets is
--     many times DevicesAffected, repeat failures are piling up as separate tickets.
SELECT Category,
       COUNT(*)                                         AS OpenTickets,
       COUNT(DISTINCT DeviceId)                         AS DevicesAffected,
       CAST(1.0 * COUNT(*) / COUNT(DISTINCT DeviceId) AS decimal(5,1)) AS TicketsPerDevice
FROM dbo.persona_factticket
WHERE Kind = 'inc' AND IsOpen = 1
GROUP BY Category
ORDER BY OpenTickets DESC;
