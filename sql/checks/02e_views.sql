/*
  Step 2e check — run in the lakehouse SQL analytics endpoint after
  sql/gold/persona_vw_api_v1.sql. Expected results are in the comments.
*/

-- 1 · Ten views, with their column counts:
--     device 18 · device_app 2 · device_ticket 8 · freshness 2 · migration 3 ·
--     persona 8 · persona_app 3 · ticket 16 · ticket_category 3 · title_mapping 6
SELECT TABLE_NAME AS ViewName, COUNT(*) AS Columns,
       STRING_AGG(COLUMN_NAME, ', ') WITHIN GROUP (ORDER BY ORDINAL_POSITION) AS ColumnList
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME LIKE 'persona[_]vw[_]api[_]v1[_]%'
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;

-- 2 · Rows per view. Expect: freshness 1 · persona 6 · persona_app 25 ·
--     ticket_category 6 (no request categories) · device 5,000 ·
--     device_ticket about 1,900 (incidents opened in the last 30 days) ·
--     device_app 95,000 (19 distinct contract apps × 5,000) · ticket 3,439 ·
--     title_mapping 210 · migration 0 (one snapshot so far)
SELECT 'freshness' AS V, COUNT(*) AS N FROM dbo.persona_vw_api_v1_freshness
UNION ALL SELECT 'persona', COUNT(*) FROM dbo.persona_vw_api_v1_persona
UNION ALL SELECT 'persona_app', COUNT(*) FROM dbo.persona_vw_api_v1_persona_app
UNION ALL SELECT 'ticket_category', COUNT(*) FROM dbo.persona_vw_api_v1_ticket_category
UNION ALL SELECT 'device', COUNT(*) FROM dbo.persona_vw_api_v1_device
UNION ALL SELECT 'device_ticket', COUNT(*) FROM dbo.persona_vw_api_v1_device_ticket
UNION ALL SELECT 'device_app', COUNT(*) FROM dbo.persona_vw_api_v1_device_app
UNION ALL SELECT 'ticket', COUNT(*) FROM dbo.persona_vw_api_v1_ticket
UNION ALL SELECT 'title_mapping', COUNT(*) FROM dbo.persona_vw_api_v1_title_mapping
UNION ALL SELECT 'migration', COUNT(*) FROM dbo.persona_vw_api_v1_migration;

-- 3 · Personas as /api/personas will return them. Expect DEV 546 · KW 1542 ·
--     CC 812 · FIELD 780 · EXEC 205 · RETAIL 1115, in that order
SELECT id, name, sub, hue, [count] FROM dbo.persona_vw_api_v1_persona ORDER BY sortOrder;

-- 4 · One device end to end, as the Device page will see it: the device, its
--     tickets from the last 30 days and its installed contract apps
SELECT TOP 1 d.*,
       (SELECT COUNT(*) FROM dbo.persona_vw_api_v1_device_ticket t WHERE t.deviceId = d.id) AS tickets30d,
       (SELECT COUNT(*) FROM dbo.persona_vw_api_v1_device_app a WHERE a.deviceId = d.id)    AS installedApps
FROM dbo.persona_vw_api_v1_device d
WHERE EXISTS (SELECT 1 FROM dbo.persona_vw_api_v1_device_ticket t WHERE t.deviceId = d.id)
ORDER BY d.host;
