/*
  Persona Fleet Command — persona_policy seed (step 5)
  ------------------------------------------------------------------------
  Run in the SQL database in Fabric, after 05a_schema.sql.

  Values are the adopted seed table in backend.md ("Persona seed values",
  18 Sep 2026). RAM, storage and CPU are calibrated against the fleet's real
  hardware tiers (sql/discovery.sql block 9) and sit exactly on a tier — a
  baseline between tiers makes fitClass() return zero fit devices, because a
  device is only "fit" when it is below baseline on nothing. Engineering
  stays at 32 GB and Executive at 16 GB deliberately: a baseline states what
  the work needs, not what balances a chart (AD-10).

  **This seed never overwrites.** Every statement is INSERT ... WHERE NOT
  EXISTS, so re-running it restores missing personas and leaves existing
  rows untouched. persona_policy is the one table humans edit (Baselines
  page, step 9); a MERGE or DELETE+INSERT here would silently revert their
  work the next time anyone re-ran the file. To correct an adopted baseline,
  write an explicit UPDATE and record why in backend.md — that way the
  change is deliberate and attributable, which the UpdatedBy column exists
  to capture.

  Safe to re-run.
*/

INSERT INTO dbo.persona_policy (
  PersonaKey, RamGB, StorageGB, CpuScore, BootSec, Crashes, FreePct,
  BatteryPct, TicketsPer100, WeightProv, WeightPerf, WeightComp, WeightExp,
  WeightSup, UpdatedBy
)
SELECT seed.*, 'seed (step 5)'
FROM (VALUES
  -- Key       RAM  SSD   CPU Boot Crash Free Batt Tkt  Prov Perf Comp Exp Sup
  ('KW',        16,  512,  60,  45,   3,  15,  70,  30,  20,  20,  25, 15, 20),
  ('RETAIL',     8,  256,  45,  40,   2,  15,  80,  30,  15,  25,  25, 15, 20),
  ('CC',        16,  512,  60,  50,   3,  15,  65,  30,  20,  25,  20, 10, 25),
  ('FIELD',     16,  512,  60,  45,   3,  18,  80,  30,  20,  15,  20, 30, 15),
  ('DEV',       32, 1024,  88,  40,   2,  20,  75,  30,  30,  30,  15, 10, 15),
  ('EXEC',      16,  512,  72,  35,   1,  25,  85,  30,  25,  25,  20, 20, 10)
) AS seed (
  PersonaKey, RamGB, StorageGB, CpuScore, BootSec, Crashes, FreePct,
  BatteryPct, TicketsPer100, WeightProv, WeightPerf, WeightComp, WeightExp,
  WeightSup
)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.persona_policy AS existing
  WHERE existing.PersonaKey = seed.PersonaKey
);
GO
