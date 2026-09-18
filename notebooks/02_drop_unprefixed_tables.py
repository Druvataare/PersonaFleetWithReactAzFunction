# Persona Fleet Command — one-off cleanup after adopting the persona_ prefix (AD-19)
#
# Part 2a first created dimpersona, dimcpumodel and dimslatarget without the
# prefix (and 2c's tables too, if it was run before the rename). Run this
# AFTER 02a (and 02c) have been re-run under the new names.
#
# Each old table is dropped only if its persona_ replacement already exists,
# so running this early does no harm — it just skips.

# %% [1] Drop the unprefixed tables whose replacements exist
RENAMED = {
    "dimpersona": "persona_dimpersona",
    "dimcpumodel": "persona_dimcpumodel",
    "dimslatarget": "persona_dimslatarget",
    "dimpersonaapp": "persona_dimpersonaapp",
    "dimticketcategory": "persona_dimticketcategory",
}
for old, new in RENAMED.items():
    if not spark.catalog.tableExists(old):
        print(f"{old}: not present, nothing to do")
    elif not spark.catalog.tableExists(new):
        print(f"{old}: KEPT — {new} does not exist yet; run its notebook first")
    else:
        spark.sql(f"DROP TABLE {old}")
        print(f"{old}: dropped ({new} exists)")

# %% [2] Check — no unprefixed project tables remain
left = [old for old in RENAMED if spark.catalog.tableExists(old)]
assert not left, f"Still present: {', '.join(left)} — see the messages above"
print("OK: only persona_ tables remain")
