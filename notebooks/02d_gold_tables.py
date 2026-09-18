# Persona Fleet Command — Step 2d: gold tables
#
# Builds the five gold tables the API reads, from bronze telemetry:
#   persona_factdevicemetrics    one row per device per AsOfDate — everything the Device type needs
#   persona_factdeviceapp        catalogue apps found on each device
#   persona_factticket           incidents (remediation jobs) and requests (self-service installs)
#   persona_facttitlemapping     job title × department → persona, with confidence
#   persona_factpersonasnapshot  every user's persona, one row per run date (migration history)
#
# How to run: same notebook setup as 02a (lakehouse attached as default).
# Paste each "# %%" block into its own cell and run them in order (or Run all).
# Cell 1 stops the run if any input column is missing. The last two cells print
# checks and the numbers used to calibrate baselines in 2e. Then run
# sql/checks/02d_gold_tables.sql in the SQL analytics endpoint.
#
# Safe to re-run: the snapshot tables replace only their own date; the others
# are rebuilt whole. Decisions behind each rule: backend.md (AD-7, AD-10,
# AD-13, AD-16, AD-18, and the 2b result).

# %% [1] Input check (AD-18) — every source column this notebook reads, by name and type family
EXPECTED = {
    "dimdevice": {"DeviceId": "s", "DeviceName": "s", "DeviceModel": "s", "CPUModel": "s", "RAM_GB": "n",
                  "SSD_GB": "n", "OSVersion": "s", "OSBuild": "s", "PrimaryUserId": "s", "PrimaryUserDisplayName": "s"},
    "dimuser": {"UserId": "s", "EmailId": "s", "Department": "s", "JobTitle": "s", "LocationRegion": "s", "Persona": "s"},
    "intune_device_identity_bridge": {"DeviceId": "s", "EntraDeviceId": "s"},
    "intune_dim_managed_device": {"DeviceId": "s", "FreeStorageSpaceInBytes": "n", "TotalStorageSpaceInBytes": "n",
                                  "LastSyncDateTime": "t"},
    "tbl_brz_bootperf_event": {"EntraDeviceId": "s", "EventTimeUtc": "t", "MainPathBootTimeMs": "n"},
    "tbl_brz_crashdiag": {"EntraDeviceId": "s"},
    "tbl_brz_crashdiag_bsod": {"EntraDeviceId": "s", "EventTimeUtc": "t"},
    "tbl_brz_crashdiag_abnormal": {"EntraDeviceId": "s", "EventTimeUtc": "t"},
    "tbl_brz_hf_battery": {"EntraDeviceId": "s", "SampleTimeUtc": "t", "BatteryPresent": "b", "HealthPercent": "n"},
    "tbl_brz_intune_windows_update_status": {"DeviceId": "s", "Date": "d", "UpdateStatus": "s"},
    "tbl_brz_systeminfo_software": {"EntraDeviceId": "s", "Name": "s"},
    "tbl_brz_epfix_eventlifecycle": {"jobId": "s", "ruleId": "s", "eventType": "s", "entraDeviceId": "s",
                                     "timestampUtc": "s", "EnqueuedAtUtc": "t", "detail": "s", "agentName": "s"},
    "tbl_brz_intune_app_deployment": {"DeviceId": "s", "ApplicationName": "s", "AssignmentIntent": "s",
                                      "InstallState": "s", "Date": "d"},
    "tbl_brz_entra_group_membership": {"UserId": "s", "GroupDisplayName": "s", "IsCurrent": "b"},
    "persona_dimpersona": {"PersonaKey": "s", "SourcePersonaValue": "s", "PersonaName": "s"},
    "persona_dimcpumodel": {"CPUModel": "s", "CpuScore": "n"},
    "persona_dimpersonaapp": {"PersonaKey": "s", "AppName": "s", "MatchPattern": "s"},
    "persona_dimticketcategory": {"Kind": "s", "CategoryName": "s", "MatchValue": "s"},
    "persona_dimslatarget": {"Priority": "s", "TargetHours": "n"},
}


def family(spark_type):
    t = spark_type.simpleString()
    if t == "string":
        return "s"
    if t == "timestamp" or t == "timestamp_ntz":
        return "t"
    if t == "date":
        return "d"
    if t == "boolean":
        return "b"
    if t in ("tinyint", "smallint", "int", "bigint", "float", "double") or t.startswith("decimal"):
        return "n"
    return t


problems = []
for table, columns in EXPECTED.items():
    if not spark.catalog.tableExists(table):
        problems.append(f"{table}: table missing")
        continue
    actual = {f.name: family(f.dataType) for f in spark.table(table).schema.fields}
    for column, want in columns.items():
        if column not in actual:
            problems.append(f"{table}.{column}: column missing")
        elif actual[column] != want:
            problems.append(f"{table}.{column}: expected type family '{want}', found '{actual[column]}'")
assert not problems, "Input check failed — nothing was written:\n  " + "\n  ".join(problems)
print(f"OK: {sum(len(c) for c in EXPECTED.values())} input columns across {len(EXPECTED)} tables are present")

# %% [2] AsOfDate, windows and the device identity spine (AD-7)
# Windows are anchored to the data's latest boot event, never to today (2b result).
as_of = spark.sql("SELECT CAST(MAX(EventTimeUtc) AS DATE) AS d FROM tbl_brz_bootperf_event").first().d
AS_OF = as_of.isoformat()                      # e.g. '2026-09-09'
WINDOW_30 = f"DATE_SUB(DATE '{AS_OF}', 29)"    # 30 days including AsOfDate
WINDOW_84 = f"DATE_SUB(DATE '{AS_OF}', 83)"    # 12 weeks, for the ticket timeline
print(f"AsOfDate = {AS_OF}; 30-day window from {spark.sql(f'SELECT {WINDOW_30} AS d').first().d}")

spark.sql(
    """
    CREATE OR REPLACE TEMP VIEW spine AS
    SELECT d.DeviceId, b.EntraDeviceId, d.DeviceName, d.DeviceModel, d.CPUModel, d.RAM_GB, d.SSD_GB,
           d.OSVersion, d.OSBuild, d.PrimaryUserDisplayName, u.UserId, u.EmailId, u.Department,
           u.JobTitle, u.LocationRegion, p.PersonaKey
    FROM dimdevice d
    JOIN dimuser u                        ON u.UserId = d.PrimaryUserId
    JOIN intune_device_identity_bridge b  ON b.DeviceId = d.DeviceId
    JOIN persona_dimpersona p             ON p.SourcePersonaValue = u.Persona
    """
)
devices, distinct_devices = spark.sql("SELECT COUNT(*), COUNT(DISTINCT DeviceId) FROM spine").first()
all_devices = spark.table("dimdevice").count()
assert devices == distinct_devices == all_devices, (
    f"Spine has {devices} rows / {distinct_devices} devices, dimdevice has {all_devices}: "
    "a device is missing its user, bridge row or persona, or is duplicated"
)
print(f"OK: spine resolves all {devices} devices to a user, an Entra id and a persona")

# %% [3] persona_factdevicemetrics — one row per device per AsOfDate
metrics = spark.sql(
    f"""
    WITH boot AS (
        SELECT EntraDeviceId, PERCENTILE_APPROX(MainPathBootTimeMs, 0.5) / 1000.0 AS BootSec
        FROM tbl_brz_bootperf_event
        WHERE CAST(EventTimeUtc AS DATE) BETWEEN {WINDOW_30} AND DATE '{AS_OF}'
          AND MainPathBootTimeMs > 0
        GROUP BY EntraDeviceId
    ),
    crash_reporting AS (SELECT DISTINCT EntraDeviceId FROM tbl_brz_crashdiag),
    crash_events AS (
        SELECT EntraDeviceId, COUNT(*) AS Crashes
        FROM (
            SELECT EntraDeviceId, EventTimeUtc FROM tbl_brz_crashdiag_bsod
            UNION ALL
            SELECT EntraDeviceId, EventTimeUtc FROM tbl_brz_crashdiag_abnormal
        ) c
        WHERE CAST(EventTimeUtc AS DATE) BETWEEN {WINDOW_30} AND DATE '{AS_OF}'
        GROUP BY EntraDeviceId
    ),
    battery AS (
        SELECT EntraDeviceId,
               MAX_BY(CASE WHEN BatteryPresent THEN HealthPercent END, SampleTimeUtc) AS BatteryHealthPct
        FROM tbl_brz_hf_battery
        WHERE CAST(SampleTimeUtc AS DATE) <= DATE '{AS_OF}'
        GROUP BY EntraDeviceId
    ),
    storage AS (
        SELECT DeviceId,
               MAX_BY(100.0 * FreeStorageSpaceInBytes / NULLIF(TotalStorageSpaceInBytes, 0), LastSyncDateTime) AS FreePct,
               MAX(LastSyncDateTime) AS LastSync
        FROM intune_dim_managed_device
        GROUP BY DeviceId
    ),
    patch AS (
        SELECT DeviceId, MAX_BY(UpdateStatus, `Date`) = 'upToDate' AS IsPatched
        FROM tbl_brz_intune_windows_update_status
        WHERE `Date` <= DATE '{AS_OF}'
        GROUP BY DeviceId
    )
    SELECT
        DATE '{AS_OF}'                                              AS SnapshotDate,
        s.DeviceId, s.EntraDeviceId, s.PersonaKey,
        s.DeviceName, s.UserId, s.PrimaryUserDisplayName            AS UserDisplayName,
        s.EmailId                                                   AS Email,
        s.Department, s.JobTitle,
        s.LocationRegion                                            AS Site,
        s.DeviceModel                                               AS Model,
        s.CPUModel, c.CpuScore,
        CAST(s.RAM_GB AS INT)                                       AS RamGB,
        CAST(s.SSD_GB AS INT)                                       AS StorageGB,
        CONCAT(CASE WHEN s.OSVersion LIKE '%Windows 11%' THEN 'Win11' ELSE 'Win10' END, ' ',
               CASE SPLIT(s.OSBuild, '\\\\.')[2]
                    WHEN '26100' THEN '24H2' WHEN '22631' THEN '23H2' WHEN '19045' THEN '22H2'
                    ELSE CONCAT('build ', SPLIT(s.OSBuild, '\\\\.')[2]) END) AS OsBuild,
        ROUND(st.FreePct, 1)                                        AS FreePct,
        ROUND(bo.BootSec, 1)                                        AS BootSec,
        CASE WHEN cr.EntraDeviceId IS NULL THEN NULL
             ELSE CAST(COALESCE(ce.Crashes, 0) AS INT) END          AS Crashes30d,
        ROUND(ba.BatteryHealthPct, 1)                               AS BatteryHealthPct,
        pa.IsPatched,
        DATEDIFF(DATE '{AS_OF}', CAST(st.LastSync AS DATE))         AS LastSeenDays,
        CONCAT_WS(',',
            CASE WHEN st.FreePct IS NULL THEN 'freePct' END,
            CASE WHEN bo.BootSec IS NULL THEN 'bootSec' END,
            CASE WHEN cr.EntraDeviceId IS NULL THEN 'crashes' END,
            CASE WHEN ba.EntraDeviceId IS NULL THEN 'battery' END,
            CASE WHEN pa.IsPatched IS NULL THEN 'patched' END,
            CASE WHEN st.LastSync IS NULL THEN 'lastSeen' END)      AS MissingMeasures
    FROM spine s
    JOIN persona_dimcpumodel c   ON c.CPUModel = s.CPUModel
    LEFT JOIN boot bo            ON bo.EntraDeviceId = s.EntraDeviceId
    LEFT JOIN crash_reporting cr ON cr.EntraDeviceId = s.EntraDeviceId
    LEFT JOIN crash_events ce    ON ce.EntraDeviceId = s.EntraDeviceId
    LEFT JOIN battery ba         ON ba.EntraDeviceId = s.EntraDeviceId
    LEFT JOIN storage st         ON st.DeviceId = s.DeviceId
    LEFT JOIN patch pa           ON pa.DeviceId = s.DeviceId
    """
)


def save_snapshot(df, table, date_column, date_value):
    """Replaces only `date_value`'s rows, so a re-run for the same date is idempotent."""
    writer = df.write.format("delta").partitionBy(date_column)
    if spark.catalog.tableExists(table):
        writer.mode("overwrite").option("replaceWhere", f"{date_column} = '{date_value}'").saveAsTable(table)
    else:
        writer.mode("overwrite").saveAsTable(table)
    print(f"{table}: {df.count()} rows for {date_value}")


save_snapshot(metrics, "persona_factdevicemetrics", "SnapshotDate", AS_OF)


def save_whole(df, table):
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    print(f"{table}: {spark.table(table).count()} rows")


# %% [4] persona_factdeviceapp — catalogue apps found on each device (AD-13)
save_whole(
    spark.sql(
        """
        SELECT DISTINCT s.DeviceId, s.PersonaKey, a.AppName, a.PersonaKey AS AppPersonaKey
        FROM (SELECT DISTINCT EntraDeviceId, Name FROM tbl_brz_systeminfo_software) sw
        JOIN spine s                  ON s.EntraDeviceId = sw.EntraDeviceId
        JOIN persona_dimpersonaapp a  ON sw.Name LIKE a.MatchPattern
        """
    ),
    "persona_factdeviceapp",
)

# %% [5] persona_factticket — incidents and requests (AD-10)
# Incidents: remediation jobs ending ESCALATED or FAILED. No resolution events
# exist, so a failure closes when the same rule next succeeds on the same device.
# Repeat failures are one ticket: every failure before the same next success is
# one episode — grouped by device, rule and that close time — with the attempts
# counted in FailureCount (2e: 52 devices failed the same fix ~10 times each).
# P2 if any attempt was escalated to a person, otherwise P3.
# Requests: an 'available' app first appearing on a device after the data
# starts — a self-service install; open only if its latest state failed.
# Final state = the latest event; on a timestamp tie the terminal event wins over RUNNING/RECEIVED.
spark.sql(
    """
    CREATE OR REPLACE TEMP VIEW jobs AS
    SELECT jobId, FIRST(ruleId, TRUE) AS ruleId, FIRST(entraDeviceId, TRUE) AS EntraDeviceId,
           MIN(ts) AS OpenedUtc, MAX(ts) AS FinalUtc,
           MAX_BY(eventType, STRUCT(ts, stage)) AS FinalState,
           MAX_BY(agentName, STRUCT(ts, stage)) AS Agent
    FROM (
        SELECT jobId, ruleId, entraDeviceId, eventType, agentName,
               COALESCE(CAST(timestampUtc AS TIMESTAMP), EnqueuedAtUtc) AS ts,
               CASE eventType WHEN 'RECEIVED' THEN 0 WHEN 'RUNNING' THEN 1 ELSE 2 END AS stage
        FROM tbl_brz_epfix_eventlifecycle
        WHERE eventType <> 'HEARTBEAT'
    ) e
    GROUP BY jobId
    """
)
incidents = spark.sql(
    f"""
    WITH inc AS (SELECT * FROM jobs WHERE FinalState IN ('ESCALATED', 'FAILED')),
    closed AS (
        SELECT i.jobId, MIN(ok.FinalUtc) AS ClosedUtc
        FROM inc i
        JOIN jobs ok ON ok.EntraDeviceId = i.EntraDeviceId AND ok.ruleId = i.ruleId
                    AND ok.FinalState = 'SUCCESS' AND ok.OpenedUtc > i.FinalUtc
        GROUP BY i.jobId
    ),
    episodes AS (   -- NULL ClosedUtc groups together: the one still-open episode per device and rule
        SELECT i.EntraDeviceId, i.ruleId, cl.ClosedUtc,
               MIN_BY(i.jobId, i.OpenedUtc)                            AS TicketId,
               MIN(i.OpenedUtc)                                        AS OpenedUtc,
               COUNT(*)                                                AS FailureCount,
               MAX(CASE WHEN i.FinalState = 'ESCALATED' THEN 1 ELSE 0 END) = 1 AS Escalated,
               MAX_BY(i.Agent, i.FinalUtc)                             AS Agent
        FROM inc i
        LEFT JOIN closed cl ON cl.jobId = i.jobId
        GROUP BY i.EntraDeviceId, i.ruleId, cl.ClosedUtc
    )
    SELECT e.TicketId, 'inc' AS Kind, s.DeviceId, s.UserId, s.PersonaKey, s.Department,
           c.CategoryName AS Category,
           CONCAT(c.CategoryName, ' fix ', CASE WHEN e.Escalated THEN 'escalated to support' ELSE 'failed' END,
                  CASE WHEN e.FailureCount > 1 THEN CONCAT(' (', e.FailureCount, ' attempts)') ELSE '' END) AS ShortDescription,
           CASE WHEN e.Escalated THEN 'P2' ELSE 'P3' END AS Priority,
           CASE WHEN e.ClosedUtc IS NOT NULL THEN 'Resolved'
                WHEN e.Escalated THEN 'Escalated' ELSE 'Failed' END AS State,
           e.ClosedUtc IS NULL AS IsOpen,
           COALESCE(e.Agent, 'Endpoint remediation') AS AssignmentGroup,
           e.OpenedUtc, e.ClosedUtc, CAST(e.FailureCount AS INT) AS FailureCount
    FROM episodes e
    JOIN spine s                      ON s.EntraDeviceId = e.EntraDeviceId
    JOIN persona_dimticketcategory c  ON c.Kind = 'inc' AND c.MatchValue = e.ruleId
    WHERE CAST(e.OpenedUtc AS DATE) BETWEEN {WINDOW_84} AND DATE '{AS_OF}'
    """
)
requests = spark.sql(
    f"""
    WITH first_seen AS (
        SELECT DeviceId, ApplicationName, MIN(`Date`) AS FirstDate, MAX_BY(InstallState, `Date`) AS LastState
        FROM tbl_brz_intune_app_deployment
        WHERE AssignmentIntent = 'available'
        GROUP BY DeviceId, ApplicationName
    ),
    start AS (SELECT MIN(`Date`) AS MinDate FROM tbl_brz_intune_app_deployment)
    SELECT CONCAT('REQ-', SUBSTR(SHA2(CONCAT_WS('|', f.DeviceId, f.ApplicationName), 256), 1, 10)) AS TicketId,
           'req' AS Kind, s.DeviceId, s.UserId, s.PersonaKey, s.Department,
           f.ApplicationName AS Category,
           CONCAT('Install ', f.ApplicationName) AS ShortDescription,
           'P4' AS Priority,
           CASE WHEN f.LastState = 'failed' THEN 'Failed' ELSE 'Fulfilled' END AS State,
           f.LastState = 'failed' AS IsOpen,
           'Intune' AS AssignmentGroup,
           CAST(f.FirstDate AS TIMESTAMP) AS OpenedUtc,
           CASE WHEN f.LastState = 'failed' THEN NULL ELSE CAST(f.FirstDate AS TIMESTAMP) END AS ClosedUtc,
           1 AS FailureCount
    FROM first_seen f
    CROSS JOIN start
    JOIN spine s ON s.DeviceId = f.DeviceId
    WHERE f.FirstDate > start.MinDate
      AND f.FirstDate BETWEEN {WINDOW_84} AND DATE '{AS_OF}'
    """
)
tickets = incidents.unionByName(requests)
tickets.createOrReplaceTempView("tickets_raw")
save_whole(
    spark.sql(
        f"""
        SELECT t.*,
               DATEDIFF(COALESCE(CAST(t.ClosedUtc AS DATE), DATE '{AS_OF}'), CAST(t.OpenedUtc AS DATE)) AS AgeDays,
               CAST(FLOOR(DATEDIFF(DATE '{AS_OF}', CAST(t.OpenedUtc AS DATE)) / 7) AS INT)            AS WeekIndex,
               (UNIX_TIMESTAMP(COALESCE(t.ClosedUtc, CAST(DATE_ADD(DATE '{AS_OF}', 1) AS TIMESTAMP)))
                 - UNIX_TIMESTAMP(t.OpenedUtc)) / 3600.0 > sla.TargetHours                          AS IsSlaBreached
        FROM tickets_raw t
        JOIN persona_dimslatarget sla ON sla.Priority = t.Priority
        """
    ),
    "persona_factticket",
)

# %% [6] persona_facttitlemapping — confidence = HR persona agrees with Entra persona group (AD-16)
save_whole(
    spark.sql(
        """
        WITH grp AS (
            SELECT UserId, MIN(REPLACE(GroupDisplayName, 'Persona - ', '')) AS GroupPersona
            FROM tbl_brz_entra_group_membership
            WHERE IsCurrent AND GroupDisplayName LIKE 'Persona - %' AND UserId IS NOT NULL
            GROUP BY UserId
        ),
        users AS (
            SELECT u.JobTitle, u.Department, p.PersonaKey, p.PersonaName, u.Persona, g.GroupPersona,
                   COALESCE(g.GroupPersona = u.Persona, FALSE) AS Agrees
            FROM dimuser u
            JOIN persona_dimpersona p ON p.SourcePersonaValue = u.Persona
            LEFT JOIN grp g ON g.UserId = u.UserId
        ),
        agg AS (
            SELECT JobTitle, Department, MIN(PersonaKey) AS PersonaKey, MIN(PersonaName) AS PersonaName,
                   COUNT(*) AS UserCount, SUM(CAST(Agrees AS INT)) AS Agreeing
            FROM users
            GROUP BY JobTitle, Department
        ),
        worst AS (   -- the most common disagreement per title × department, if any
            SELECT JobTitle, Department, Other, N
            FROM (
                SELECT JobTitle, Department, COALESCE(GroupPersona, '') AS Other, COUNT(*) AS N,
                       ROW_NUMBER() OVER (PARTITION BY JobTitle, Department ORDER BY COUNT(*) DESC) AS rn
                FROM users WHERE NOT Agrees
                GROUP BY JobTitle, Department, COALESCE(GroupPersona, '')
            ) x
            WHERE rn = 1
        )
        SELECT a.JobTitle, a.Department, a.PersonaKey, a.PersonaName, a.UserCount,
               CAST(ROUND(100.0 * a.Agreeing / a.UserCount) AS INT) AS ConfidenceScore,
               CASE WHEN w.N IS NULL THEN ''
                    WHEN w.Other = '' THEN CONCAT(w.N, ' of ', a.UserCount, ' users are in no persona group')
                    ELSE CONCAT(w.N, ' of ', a.UserCount, ' users are in Persona - ', w.Other) END AS FlagReason
        FROM agg a
        LEFT JOIN worst w ON w.JobTitle = a.JobTitle AND w.Department = a.Department
        """
    ),
    "persona_facttitlemapping",
)

# %% [7] persona_factpersonasnapshot — today's persona for every user (migration history)
from datetime import datetime, timezone

RUN_DATE = datetime.now(timezone.utc).date().isoformat()
save_snapshot(
    spark.sql(
        f"""
        SELECT DATE '{RUN_DATE}' AS SnapshotDate, u.UserId, p.PersonaKey
        FROM dimuser u JOIN persona_dimpersona p ON p.SourcePersonaValue = u.Persona
        """
    ),
    "persona_factpersonasnapshot",
    "SnapshotDate",
    RUN_DATE,
)

# %% [8] Checks — coverage, totals and the expected figures from discovery
m = spark.sql(f"SELECT * FROM persona_factdevicemetrics WHERE SnapshotDate = DATE '{AS_OF}'")
m.createOrReplaceTempView("m")
display(spark.sql(
    """
    SELECT COUNT(*) AS Devices,
           SUM(CASE WHEN FreePct IS NULL THEN 1 ELSE 0 END)          AS NoFreePct,
           SUM(CASE WHEN BootSec IS NULL THEN 1 ELSE 0 END)          AS NoBootSec,
           SUM(CASE WHEN Crashes30d IS NULL THEN 1 ELSE 0 END)       AS NoCrashData,
           SUM(CASE WHEN BatteryHealthPct IS NULL THEN 1 ELSE 0 END) AS NoBattery,
           SUM(CASE WHEN IsPatched IS NULL THEN 1 ELSE 0 END)        AS NoPatchState,
           SUM(CASE WHEN OsBuild LIKE '%build%' THEN 1 ELSE 0 END)   AS UnknownOsBuild
    FROM m
    """
))
display(spark.sql(
    """
    SELECT Kind, State, Priority, COUNT(*) AS Tickets, SUM(FailureCount) AS Attempts,
           SUM(CAST(IsOpen AS INT)) AS Open, SUM(CAST(IsSlaBreached AS INT)) AS SlaBreached
    FROM persona_factticket GROUP BY Kind, State, Priority ORDER BY Kind, Priority, State
    """
))
display(spark.sql(
    """
    SELECT Category, COUNT(*) AS Requests, SUM(CAST(IsOpen AS INT)) AS Failed
    FROM persona_factticket WHERE Kind = 'req' GROUP BY Category ORDER BY Requests DESC
    """
))
display(spark.sql(
    """
    SELECT ConfidenceScore, COUNT(*) AS TitleDeptRows, SUM(UserCount) AS Users
    FROM persona_facttitlemapping GROUP BY ConfidenceScore ORDER BY ConfidenceScore
    """
))

assert m.count() == all_devices, "persona_factdevicemetrics is missing devices"
failed_jobs, first_day = spark.sql(
    "SELECT COUNT(*), CAST(MIN(OpenedUtc) AS DATE) FROM jobs WHERE FinalState IN ('ESCALATED','FAILED')"
).first()
tickets_inc, attempts = spark.sql(
    "SELECT COUNT(*), SUM(FailureCount) FROM persona_factticket WHERE Kind = 'inc'"
).first()
# Every failed job belongs to exactly one ticket while the data fits the 12-week window.
if (as_of - first_day).days <= 83:
    assert attempts == failed_jobs, f"{failed_jobs} failed jobs but tickets account for {attempts} — a job lost its device or category"
users_mapped = spark.sql("SELECT SUM(UserCount) FROM persona_facttitlemapping").first()[0]
assert users_mapped == spark.table("dimuser").count(), "persona_facttitlemapping does not cover every user"
print(f"OK: {m.count()} devices, {attempts} failed jobs folded into {tickets_inc} incident tickets, "
      f"{users_mapped} users mapped, AsOfDate {AS_OF}")

# %% [9] Calibration figures for 2e — what each persona's devices actually measure
display(spark.sql(
    f"""
    SELECT m.PersonaKey, COUNT(*) AS Devices,
           PERCENTILE_APPROX(m.BootSec, ARRAY(0.25, 0.5, 0.75))          AS BootSec_p25_p50_p75,
           ROUND(AVG(m.Crashes30d), 2)                                   AS AvgCrashes30d,
           ROUND(100.0 * AVG(CASE WHEN m.Crashes30d > 0 THEN 1 ELSE 0 END), 1) AS PctWithCrash,
           PERCENTILE_APPROX(m.FreePct, ARRAY(0.25, 0.5, 0.75))          AS FreePct_p25_p50_p75,
           PERCENTILE_APPROX(m.BatteryHealthPct, ARRAY(0.25, 0.5, 0.75)) AS Battery_p25_p50_p75,
           ROUND(100.0 * AVG(CAST(m.IsPatched AS INT)), 1)               AS PctPatched,
           ROUND(100.0 * MAX(t.Incidents30d) / COUNT(*), 1)              AS IncidentsPer100Devices30d
    FROM m
    LEFT JOIN (
        SELECT PersonaKey, COUNT(*) AS Incidents30d FROM persona_factticket
        WHERE Kind = 'inc' AND CAST(OpenedUtc AS DATE) BETWEEN {WINDOW_30} AND DATE '{AS_OF}'
        GROUP BY PersonaKey
    ) t ON t.PersonaKey = m.PersonaKey
    GROUP BY m.PersonaKey
    ORDER BY m.PersonaKey
    """
))
