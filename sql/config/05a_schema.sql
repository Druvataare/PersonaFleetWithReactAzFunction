/*
  Persona Fleet Command — configuration store schema (step 5)
  ------------------------------------------------------------------------
  Run in the **SQL database in Fabric**, not the lakehouse SQL analytics
  endpoint. These four tables are the only things the portal writes (AD-4,
  AD-5): the lakehouse stays read-only, so a write never has to wait for a
  pipeline run and policy edits take effect immediately.

  Unlike the SQL analytics endpoint — which rejects CREATE USER and most
  security DDL — a Fabric SQL database is a full T-SQL surface, so the
  invariants below are constraints rather than conventions. That matters
  because step 9 exposes these tables to the Baselines page: a constraint
  fails the write, a convention fails quietly and corrupts policy.

  No foreign keys to persona_dimpersona: it lives in the lakehouse, a
  different engine, so PersonaKey cannot be enforced by reference here.
  sql/checks/05_config_store.sql checks the two sets agree instead.

  Safe to re-run: every CREATE is guarded, so this adds what is missing and
  leaves existing tables and their data alone.
*/

-- 1 · persona_policy — baselines and pillar weights, one row per persona.
--     The only table a human edits directly (Baselines page, step 9).
IF OBJECT_ID('dbo.persona_policy', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.persona_policy (
    PersonaKey    varchar(16)  NOT NULL,
    RamGB         int          NOT NULL,
    StorageGB     int          NOT NULL,
    CpuScore      int          NOT NULL,
    BootSec       int          NOT NULL,
    Crashes       int          NOT NULL,
    FreePct       int          NOT NULL,
    BatteryPct    int          NOT NULL,
    TicketsPer100 int          NOT NULL,
    WeightProv    int          NOT NULL,
    WeightPerf    int          NOT NULL,
    WeightComp    int          NOT NULL,
    WeightExp     int          NOT NULL,
    WeightSup     int          NOT NULL,
    UpdatedBy     varchar(128) NOT NULL,
    UpdatedUtc    datetime2(3) NOT NULL
      CONSTRAINT DF_persona_policy_UpdatedUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_persona_policy PRIMARY KEY (PersonaKey),

    /* The invariant the whole score rests on. Pillar weights combine into
       persona health, so anything but 100 silently rescales every score in
       the portal — the one edit on the Baselines page that could corrupt
       results without erroring. */
    CONSTRAINT CK_persona_policy_weights_total CHECK (
      WeightProv + WeightPerf + WeightComp + WeightExp + WeightSup = 100
    ),
    CONSTRAINT CK_persona_policy_weights_sign CHECK (
      WeightProv >= 0 AND WeightPerf >= 0 AND WeightComp >= 0
      AND WeightExp >= 0 AND WeightSup >= 0
    ),
    /* Percentages and the 0-100 CPU score, bounded because this table is a
       system boundary: the values arrive from a form, not from our code. */
    CONSTRAINT CK_persona_policy_pct CHECK (
      CpuScore BETWEEN 0 AND 100
      AND FreePct BETWEEN 0 AND 100
      AND BatteryPct BETWEEN 0 AND 100
    ),
    CONSTRAINT CK_persona_policy_hardware CHECK (
      RamGB > 0 AND StorageGB > 0 AND BootSec > 0
      AND Crashes >= 0 AND TicketsPer100 >= 0
    )
  );
END;
GO

-- 2 · persona_change — a persona reassignment requested from the portal.
--     Feeds PersonaChange { date, id, user, from, to }.
IF OBJECT_ID('dbo.persona_change', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.persona_change (
    ChangeId       uniqueidentifier NOT NULL
      CONSTRAINT DF_persona_change_ChangeId DEFAULT NEWID(),
    UserId         varchar(128) NOT NULL,
    DeviceId       varchar(128) NULL,
    FromPersonaKey varchar(16)  NOT NULL,
    ToPersonaKey   varchar(16)  NOT NULL,
    /* Taken from the caller's Entra token, never from the request body —
       otherwise a client could attribute its own change to someone else. */
    RequestedBy    varchar(128) NOT NULL,
    RequestedUtc   datetime2(3) NOT NULL
      CONSTRAINT DF_persona_change_RequestedUtc DEFAULT SYSUTCDATETIME(),
    /* Supplied by the client so a retried POST is recorded once. NOT NULL
       because SQL Server permits only a single NULL in a unique index, which
       would make the second key-less retry fail for the wrong reason. */
    IdempotencyKey varchar(64)  NOT NULL,

    CONSTRAINT PK_persona_change PRIMARY KEY (ChangeId),
    CONSTRAINT UQ_persona_change_IdempotencyKey UNIQUE (IdempotencyKey),
    CONSTRAINT CK_persona_change_moves CHECK (FromPersonaKey <> ToPersonaKey)
  );
END;
GO

-- 3 · persona_provisioning_request — a hardware request raised from a device.
--     Feeds ProvisioningRequestResponse { number, group }.
IF OBJECT_ID('dbo.persona_provisioning_request', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.persona_provisioning_request (
    RequestSeq      int IDENTITY(1,1) NOT NULL,
    /* Generated here rather than in the API: the number is user-facing and
       must be unique, and two Function App instances handling concurrent
       requests cannot agree on the next one without a round trip. IDENTITY
       already solves that. */
    RequestNumber   AS ('REQ' + RIGHT('0000000' + CONVERT(varchar(7), RequestSeq), 7)) PERSISTED,
    DeviceId        varchar(128) NOT NULL,
    AssignmentGroup varchar(128) NOT NULL,
    Status          varchar(32)  NOT NULL
      CONSTRAINT DF_persona_provisioning_request_Status DEFAULT 'Requested',
    RequestedBy     varchar(128) NOT NULL,
    RequestedUtc    datetime2(3) NOT NULL
      CONSTRAINT DF_persona_provisioning_request_RequestedUtc DEFAULT SYSUTCDATETIME(),
    IdempotencyKey  varchar(64)  NOT NULL,

    CONSTRAINT PK_persona_provisioning_request PRIMARY KEY (RequestSeq),
    CONSTRAINT UQ_persona_provisioning_request_Number UNIQUE (RequestNumber),
    CONSTRAINT UQ_persona_provisioning_request_IdempotencyKey UNIQUE (IdempotencyKey)
  );
END;
GO

-- 4 · persona_app_exception — a request to run an app outside the persona's
--     catalogue. Feeds AppException { id, user, persona, app, reason, state,
--     raised }; State matches the ExceptionState union exactly.
IF OBJECT_ID('dbo.persona_app_exception', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.persona_app_exception (
    ExceptionId uniqueidentifier NOT NULL
      CONSTRAINT DF_persona_app_exception_ExceptionId DEFAULT NEWID(),
    UserId      varchar(128) NOT NULL,
    PersonaKey  varchar(16)  NOT NULL,
    AppName     varchar(256) NOT NULL,
    Reason      varchar(1024) NOT NULL,
    State       varchar(16)  NOT NULL
      CONSTRAINT DF_persona_app_exception_State DEFAULT 'Pending',
    RaisedUtc   datetime2(3) NOT NULL
      CONSTRAINT DF_persona_app_exception_RaisedUtc DEFAULT SYSUTCDATETIME(),
    DecidedBy   varchar(128) NULL,
    DecidedUtc  datetime2(3) NULL,

    CONSTRAINT PK_persona_app_exception PRIMARY KEY (ExceptionId),
    /* Exactly the ExceptionState union in packages/scoring/src/types.ts. A
       value outside it would reach the front end and match no branch. */
    CONSTRAINT CK_persona_app_exception_State CHECK (
      State IN ('Pending', 'Approved', 'Rejected')
    ),
    /* A decision needs a decider. Without this an exception can read
       "Approved" with nobody accountable for approving it, which is the one
       thing an approval record exists to prove. */
    CONSTRAINT CK_persona_app_exception_decision CHECK (
      (State = 'Pending' AND DecidedBy IS NULL AND DecidedUtc IS NULL)
      OR (State <> 'Pending' AND DecidedBy IS NOT NULL AND DecidedUtc IS NOT NULL)
    )
  );
END;
GO
