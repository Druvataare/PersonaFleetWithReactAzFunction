# Persona Fleet Command — Step 2a: reference tables
#
# Creates dimpersona, dimcpumodel and dimslatarget in the lakehouse.
#
# How to run
#   1. In Fabric, create a notebook and attach the lakehouse as its default
#      lakehouse (Explorer pane → Add lakehouse → Existing).
#   2. Paste each "# %%" block below into its own cell, in order, and run them.
#   3. Wait about a minute for the SQL analytics endpoint to pick up the new
#      tables, then run sql/checks/02a_reference_tables.sql there.
#
# Safe to re-run: each table is overwritten with exactly the values below.
# Values come from backend.md → "Persona seed values" and "dimcpumodel".

# %% [1] Helper
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


# %% [2] dimpersona — persona identity and display
# SourcePersonaValue must match dimuser.Persona exactly; it is the join key.
save(
    [
        ("DEV", "Engineering", "Engineering", "Software & platform build", "#6E7BF2", 1, 14, 3),
        ("KW", "Knowledge Worker", "Knowledge Worker", "Corporate functions", "#2FA9C9", 2, 8, 1),
        ("CC", "Call Centre", "Call Centre", "Service desk & sales", "#22A57F", 3, 11, 1),
        ("FIELD", "Field Services", "Field Services", "On-site & rugged", "#D98429", 4, 6, 4),
        ("EXEC", "Executive", "Executive", "Leadership & board", "#C4649B", 5, 5, 2),
        ("RETAIL", "Retail", "Retail", "Stores & point of sale", "#9B5FE0", 6, 7, 1),
    ],
    [
        ("PersonaKey", StringType()),
        ("SourcePersonaValue", StringType()),
        ("PersonaName", StringType()),
        ("PersonaSubtitle", StringType()),
        ("HexColour", StringType()),
        ("SortOrder", IntegerType()),
        ("TasksAutomatedPerWeek", IntegerType()),
        ("OnboardingDays", IntegerType()),
    ],
    "dimpersona",
)

# %% [3] dimcpumodel — relative CPU score per model
BASIS = "Relative multi-core capacity by core count; model names carry no vendor or generation"
save(
    [
        ("Windows 4-core", 35, BASIS),
        ("Windows 6-core", 45, BASIS),
        ("Windows 8-core", 60, BASIS),
        ("Windows 10-core", 72, BASIS),
        ("Windows 12-core", 88, BASIS),
    ],
    [("CPUModel", StringType()), ("CpuScore", IntegerType()), ("Basis", StringType())],
    "dimcpumodel",
)

# %% [4] dimslatarget — resolution target per priority, used to derive SLA breach
save(
    [("P1", 4), ("P2", 8), ("P3", 72), ("P4", 120)],
    [("Priority", StringType()), ("TargetHours", IntegerType())],
    "dimslatarget",
)

# %% [5] Check — every user's persona and every device's CPU model must resolve
unmapped_personas = spark.sql(
    """
    SELECT u.Persona, COUNT(*) AS Users
    FROM dimuser u
    LEFT ANTI JOIN dimpersona p ON p.SourcePersonaValue = u.Persona
    GROUP BY u.Persona
    """
)
unmapped_cpus = spark.sql(
    """
    SELECT d.CPUModel, COUNT(*) AS Devices
    FROM dimdevice d
    LEFT ANTI JOIN dimcpumodel c ON c.CPUModel = d.CPUModel
    GROUP BY d.CPUModel
    """
)
display(unmapped_personas)
display(unmapped_cpus)
assert unmapped_personas.count() == 0, "Some dimuser.Persona values have no dimpersona row — see the table above"
assert unmapped_cpus.count() == 0, "Some dimdevice.CPUModel values have no dimcpumodel row — see the table above"
print("OK: all 6 personas and all 5 CPU models resolve")
