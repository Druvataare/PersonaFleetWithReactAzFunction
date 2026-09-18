/*
  Step 2a check — run in the lakehouse SQL analytics endpoint after
  notebooks/02a_reference_tables.py. New tables can take about a minute to
  appear here. Expected results are in the comments.
*/

-- 1 · Six personas, in SortOrder: DEV, KW, CC, FIELD, EXEC, RETAIL
SELECT * FROM dbo.persona_dimpersona ORDER BY SortOrder;

-- 2 · Every user resolves to a persona. Expect 6 rows, no NULL PersonaKey:
--     Knowledge Worker 1542 · Retail 1115 · Call Centre 812 ·
--     Field Services 780 · Engineering 546 · Executive 205
SELECT u.Persona, p.PersonaKey, COUNT(*) AS Users
FROM dbo.dimuser u
LEFT JOIN dbo.persona_dimpersona p ON p.SourcePersonaValue = u.Persona
GROUP BY u.Persona, p.PersonaKey
ORDER BY Users DESC;

-- 3 · Every device resolves to a CPU score. Expect 5 rows, no NULL CpuScore,
--     devices totalling 5,000
SELECT d.CPUModel, c.CpuScore, COUNT(*) AS Devices
FROM dbo.dimdevice d
LEFT JOIN dbo.persona_dimcpumodel c ON c.CPUModel = d.CPUModel
GROUP BY d.CPUModel, c.CpuScore
ORDER BY c.CpuScore;

-- 4 · Four SLA targets: P1 4 · P2 8 · P3 72 · P4 120 hours
SELECT * FROM dbo.persona_dimslatarget ORDER BY Priority;
