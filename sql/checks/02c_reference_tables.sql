/*
  Step 2c check — run in the lakehouse SQL analytics endpoint after
  notebooks/02c_reference_tables.py. Expected results are in the comments.
*/

-- 1 · App contract per persona. Expect 25 rows:
--     DEV 6 · KW 4 · CC 4 · FIELD 4 · EXEC 4 · RETAIL 3
SELECT PersonaKey, COUNT(*) AS Apps, STRING_AGG(AppName, ', ') WITHIN GROUP (ORDER BY SortOrder) AS Contract
FROM dbo.persona_dimpersonaapp
GROUP BY PersonaKey
ORDER BY PersonaKey;

-- 2 · Incident categories with their volumes. Expect 6 rows totalling 11,499:
--     OneDrive sync 5,560 · Browser 2,342 · Network 1,958 · Printing 567 ·
--     Disk space 552 · Windows Update 520
WITH final AS (
    SELECT jobId, ruleId, eventType,
           ROW_NUMBER() OVER (PARTITION BY jobId ORDER BY EnqueuedAtUtc DESC) AS rn
    FROM dbo.tbl_brz_epfix_eventlifecycle
    WHERE eventType <> 'HEARTBEAT'
)
SELECT c.SortOrder, c.CategoryName, COUNT(*) AS Incidents
FROM final f
JOIN dbo.persona_dimticketcategory c ON c.Kind = 'inc' AND c.MatchValue = f.ruleId
WHERE f.rn = 1 AND f.eventType IN ('ESCALATED', 'FAILED')
GROUP BY c.SortOrder, c.CategoryName
ORDER BY c.SortOrder;
