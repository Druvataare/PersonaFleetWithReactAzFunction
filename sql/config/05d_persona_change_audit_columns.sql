/*
  Persona Fleet Command — persona_change audit columns (step 9)
  ------------------------------------------------------------------------
  Run in Persona_Config_Dev, after 05a. Safe to re-run: each ALTER is guarded.

  Two additions, both so a change row can answer the contract's PersonaChange
  { date, id, user, from, to } on its own.

  UserDisplayName is stored rather than resolved later, which is a deliberate
  denormalisation. An audit record should say what was true when it was
  written: resolving the name from live data would show whoever holds that
  device today, and would show nothing at all once the device leaves the
  fleet. It also avoids a join no engine can make — the name lives in the
  lakehouse and the record lives here.

  DeviceId becomes NOT NULL because the contract's `id` is the device, so a
  row without one cannot produce a valid response. The table is empty, so
  tightening it now costs nothing; leaving it nullable would mean every read
  carrying a branch for a row that should never exist.
*/

IF COL_LENGTH('dbo.persona_change', 'UserDisplayName') IS NULL
  ALTER TABLE dbo.persona_change ADD UserDisplayName varchar(256) NOT NULL
    CONSTRAINT DF_persona_change_UserDisplayName DEFAULT '';
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.persona_change') AND name = 'DeviceId' AND is_nullable = 1
)
  ALTER TABLE dbo.persona_change ALTER COLUMN DeviceId varchar(128) NOT NULL;
GO

-- Check: expect UserDisplayName present and DeviceId is_nullable = 0.
SELECT name, TYPE_NAME(user_type_id) AS type, max_length, is_nullable
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.persona_change')
ORDER BY column_id;
