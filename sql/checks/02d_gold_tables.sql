/*
  Step 2d check — run in the lakehouse SQL analytics endpoint after
  notebooks/02d_gold_tables.py. Expected results are in the comments.
*/

-- 1 · Row counts. Expect: factdevicemetrics 5,000 (one AsOfDate) ·
--     factdeviceapp 125,000 (25 contract rows × 5,000 devices) ·
--     factticket ≥ 11,499 incidents plus any requests ·
--     facttitlemapping one row per job title × department ·
--     factpersonasnapshot 5,000 per run date
SELECT 'persona_factdevicemetrics' AS T, COUNT(*) AS N, MAX(SnapshotDate) AS Latest FROM dbo.persona_factdevicemetrics
UNION ALL SELECT 'persona_factdeviceapp', COUNT(*), NULL FROM dbo.persona_factdeviceapp
UNION ALL SELECT 'persona_factticket', COUNT(*), CAST(MAX(OpenedUtc) AS date) FROM dbo.persona_factticket
UNION ALL SELECT 'persona_facttitlemapping', COUNT(*), NULL FROM dbo.persona_facttitlemapping
UNION ALL SELECT 'persona_factpersonasnapshot', COUNT(*), MAX(SnapshotDate) FROM dbo.persona_factpersonasnapshot;

-- 2 · One device, end to end — every field the Device page needs
SELECT TOP 5 DeviceName, UserDisplayName, Site, Model, CpuScore, RamGB, StorageGB, OsBuild,
       FreePct, BootSec, Crashes30d, BatteryHealthPct, IsPatched, LastSeenDays, MissingMeasures
FROM dbo.persona_factdevicemetrics
ORDER BY DeviceName;

-- 3 · Incidents by category. Expect 11,499 in total:
--     OneDrive sync 5,560 · Browser 2,342 · Network 1,958 · Printing 567 · Disk space 552 · Windows Update 520
SELECT Category, COUNT(*) AS Incidents, SUM(CAST(IsOpen AS int)) AS StillOpen
FROM dbo.persona_factticket
WHERE Kind = 'inc'
GROUP BY Category
ORDER BY Incidents DESC;

-- 4 · Headcount per persona from the snapshot. Expect KW 1542 · RETAIL 1115 ·
--     CC 812 · FIELD 780 · DEV 546 · EXEC 205
SELECT PersonaKey, COUNT(*) AS Users
FROM dbo.persona_factpersonasnapshot
WHERE SnapshotDate = (SELECT MAX(SnapshotDate) FROM dbo.persona_factpersonasnapshot)
GROUP BY PersonaKey
ORDER BY Users DESC;
