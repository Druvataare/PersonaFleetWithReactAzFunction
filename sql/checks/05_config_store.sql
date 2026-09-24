/*
  Step 5 check — run after sql/config/05a_schema.sql and 05b_seed_persona_policy.sql.
  Blocks 1-5 run in the **SQL database in Fabric**. Block 6 runs in the
  **lakehouse SQL analytics endpoint**, because it compares the two stores.
  Expected results are in the comments.
*/

-- 1 · Six personas with their adopted baselines. Expect exactly 6 rows,
--     every UpdatedBy reading 'seed (step 5)' until someone edits one.
SELECT PersonaKey, RamGB, StorageGB, CpuScore, BootSec, Crashes, FreePct,
       BatteryPct, TicketsPer100,
       WeightProv, WeightPerf, WeightComp, WeightExp, WeightSup,
       UpdatedBy, UpdatedUtc
FROM dbo.persona_policy
ORDER BY PersonaKey;

-- 2 · Weights total 100 for every persona. Expect 6 rows, Total all 100,
--     and zero rows from the second query.
SELECT PersonaKey,
       WeightProv + WeightPerf + WeightComp + WeightExp + WeightSup AS Total
FROM dbo.persona_policy
ORDER BY PersonaKey;

SELECT PersonaKey AS BadWeightTotal
FROM dbo.persona_policy
WHERE WeightProv + WeightPerf + WeightComp + WeightExp + WeightSup <> 100;

-- 3 · The CHECK constraints exist. Expect 7 rows — four on persona_policy,
--     one on persona_change, two on persona_app_exception — none with
--     is_disabled = 1 or
--     is_not_trusted = 1 — a constraint that is present but not trusted was
--     bypassed at some point and is no longer proof of anything.
SELECT t.name AS table_name, c.name AS constraint_name,
       c.is_disabled, c.is_not_trusted
FROM sys.check_constraints AS c
JOIN sys.tables AS t ON t.object_id = c.parent_object_id
WHERE t.name LIKE 'persona[_]%'
ORDER BY t.name, c.name;

-- 4 · The weights constraint actually fires. Expect the INSERT to fail with
--     "conflicted with the CHECK constraint CK_persona_policy_weights_total".
--     Rolled back either way, so it leaves nothing behind. A constraint that
--     is never exercised is an assumption, not a guarantee.
BEGIN TRANSACTION;
BEGIN TRY
  INSERT INTO dbo.persona_policy (
    PersonaKey, RamGB, StorageGB, CpuScore, BootSec, Crashes, FreePct,
    BatteryPct, TicketsPer100, WeightProv, WeightPerf, WeightComp,
    WeightExp, WeightSup, UpdatedBy
  )
  VALUES ('_TEST', 16, 512, 60, 45, 3, 15, 70, 30, 99, 0, 0, 0, 0, 'check 05');
  SELECT 'FAIL - the bad row was accepted' AS WeightsConstraint;
END TRY
BEGIN CATCH
  SELECT 'PASS - rejected: ' + ERROR_MESSAGE() AS WeightsConstraint;
END CATCH;
ROLLBACK TRANSACTION;

-- 5 · The three writeback tables exist and are empty before step 9 uses them.
--     Expect 3 rows, all RowCount = 0.
SELECT 'persona_change' AS TableName, COUNT(*) AS [RowCount] FROM dbo.persona_change
UNION ALL
SELECT 'persona_provisioning_request', COUNT(*) FROM dbo.persona_provisioning_request
UNION ALL
SELECT 'persona_app_exception', COUNT(*) FROM dbo.persona_app_exception;

/* ---------------------------------------------------------------------------
   6 · Coverage: every persona in the lakehouse has a policy row.

   This is the step 5 test checkpoint, and it is the one check that spans both
   stores: persona_dimpersona lives in the lakehouse, persona_policy in the
   SQL database, so no foreign key can enforce it and nothing fails until a
   persona reaches the portal with no baseline to score against.

   Run this block in the **lakehouse SQL analytics endpoint**, not above. A
   Fabric SQL database mirrors into OneLake, so its tables are reachable by
   three-part name from another item in the same workspace.

   Copy this block into a query on the lakehouse endpoint; it stays commented
   here so it is not run by mistake against the SQL database, where the
   lakehouse side of the join does not exist.
   Expect 6 rows, no NULL PersonaKey in either column.

SELECT d.PersonaKey AS LakehouseKey, p.PersonaKey AS PolicyKey, d.PersonaName
FROM dbo.persona_dimpersona AS d
FULL OUTER JOIN Persona_Config_Dev.dbo.persona_policy AS p
  ON p.PersonaKey = d.PersonaKey
ORDER BY d.SortOrder;
--------------------------------------------------------------------------- */
