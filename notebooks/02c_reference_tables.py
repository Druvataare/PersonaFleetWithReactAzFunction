# Persona Fleet Command — Step 2c: persona app contracts and ticket categories
#
# Creates persona_dimpersonaapp and persona_dimticketcategory in the lakehouse.
#
# How to run: same notebook setup as 02a (lakehouse attached as default).
# Paste each "# %%" block into its own cell and run them in order, then run
# sql/checks/02c_reference_tables.sql in the SQL analytics endpoint.
#
# Safe to re-run: both tables are overwritten with exactly the values below.
# Decisions behind the values: backend.md → AD-10 and "Part 2c".

# %% [1] Helper (same as 02a)
from pyspark.sql.types import IntegerType, StringType, StructField, StructType


def save(rows, fields, table):
    """Overwrites `table` with `rows`; `fields` is a list of (name, spark type)."""
    schema = StructType([StructField(name, kind, False) for name, kind in fields])
    (
        spark.createDataFrame(rows, schema)
        .write.mode("overwrite")
        .option("overwriteSchema", "true")
        .format("delta")
        .saveAsTable(table)
    )
    print(f"{table}: {len(rows)} rows written")


# %% [2] persona_dimpersonaapp — the applications each persona is expected to need
# Proposed contract, drawn from the 26 titles installed across the estate.
# Tools every persona gets (Edge, Defender, OneDrive, 7-Zip, Notepad++, VLC,
# WinSCP) are left out, as in the wireframe: the contract lists what
# distinguishes a persona.
# MatchPattern is a SQL LIKE pattern against tbl_brz_systeminfo_software.Name;
# the names are clean, so each pattern is simply the exact title.
CONTRACT = {
    "DEV": ["Visual Studio Code", "Git", "Node.js", "Python 3.12", "Java Runtime", "Windows Terminal"],
    "KW": ["Microsoft 365 Apps", "Power BI Desktop", "Adobe Acrobat Reader", "Snagit"],
    "CC": ["SAP GUI", "Zoom Workplace", "Slack", "Greenshot"],
    "FIELD": ["SAP GUI", "Cisco Secure Client", "PuTTY", "FileZilla"],
    "EXEC": ["Microsoft 365 Apps", "Power BI Desktop", "Zoom Workplace", "Adobe Acrobat Reader"],
    "RETAIL": ["SAP GUI", "Google Chrome", "Microsoft Teams"],
}
save(
    [(pid, app, app, i + 1) for pid, apps in CONTRACT.items() for i, app in enumerate(apps)],
    [
        ("PersonaKey", StringType()),
        ("AppName", StringType()),
        ("MatchPattern", StringType()),
        ("SortOrder", IntegerType()),
    ],
    "persona_dimpersonaapp",
)

# %% [3] persona_dimticketcategory — incident categories, one per remediation rule
# escalationReason has a single value, so the category comes from ruleId
# (AD-10). Ordered by incident volume; SortOrder drives chart colour order.
# Request ('req') categories are added in 2d, once requests are measured.
save(
    [
        ("inc", "OneDrive sync", "R-041 FIX-ONEDRIVE-KFM", 1),
        ("inc", "Browser", "R-055 FIX-BROWSER-CACHE", 2),
        ("inc", "Network", "R-030 FIX-WINSOCK-RESET", 3),
        ("inc", "Printing", "R-014 FIX-PRINTSPOOLER", 4),
        ("inc", "Disk space", "R-011 FIX-DISK-CLEANUP", 5),
        ("inc", "Windows Update", "R-020 FIX-WU-SERVICE", 6),
    ],
    [
        ("Kind", StringType()),
        ("CategoryName", StringType()),
        ("MatchValue", StringType()),
        ("SortOrder", IntegerType()),
    ],
    "persona_dimticketcategory",
)

# %% [4] Check — contracts name real software, every rule has a category
software = spark.sql("SELECT DISTINCT Name FROM tbl_brz_systeminfo_software ORDER BY Name")
print(f"{software.count()} software titles in the estate:")
print(", ".join(r.Name for r in software.collect()))

unmatched_apps = spark.sql(
    """
    SELECT a.PersonaKey, a.AppName
    FROM persona_dimpersonaapp a
    LEFT ANTI JOIN (SELECT DISTINCT Name FROM tbl_brz_systeminfo_software) s
      ON s.Name LIKE a.MatchPattern
    """
)
uncontracted = spark.sql(
    """
    SELECT DISTINCT s.Name
    FROM tbl_brz_systeminfo_software s
    LEFT ANTI JOIN persona_dimpersonaapp a ON s.Name LIKE a.MatchPattern
    ORDER BY s.Name
    """
)
unmapped_rules = spark.sql(
    """
    SELECT e.ruleId, COUNT(DISTINCT e.jobId) AS Jobs
    FROM tbl_brz_epfix_eventlifecycle e
    LEFT ANTI JOIN persona_dimticketcategory c ON c.Kind = 'inc' AND c.MatchValue = e.ruleId
    WHERE e.eventType <> 'HEARTBEAT'
    GROUP BY e.ruleId
    """
)
print("\nIn no persona's contract (common to all, by design):")
print(", ".join(r.Name for r in uncontracted.collect()) or "(none)")
display(unmatched_apps)
display(unmapped_rules)
assert unmatched_apps.count() == 0, "A contract app matches no installed software title — see the table above"
assert unmapped_rules.count() == 0, "A remediation rule has no ticket category — see the table above"
print("\nOK: every contract app is real software and all 6 rules have a category")
