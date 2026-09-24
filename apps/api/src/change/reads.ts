/* GET /api/change/migrations, /api/change/exceptions and /api/persona-changes.

   Split across both stores on purpose (AD-4): migrations are derived from the
   accumulating snapshot history in the lakehouse, while exceptions and the
   change log are records the portal itself wrote, so they come from the SQL
   database and are readable the moment they are written (AD-5). */
import { app } from "@azure/functions";
import type { ExceptionsResponse, MigrationsResponse, PersonaChangesResponse } from "@pfc/contract";
import { z } from "zod";
import { readConfigStore } from "../fabric/config.ts";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";

export const migrationRow = z.object({
  from: z.string(),
  to: z.string(),
  people: z.number().int(),
});

export const exceptionRow = z.object({
  id: z.string(),
  user: z.string(),
  persona: z.string(),
  app: z.string(),
  reason: z.string(),
  state: z.enum(["Pending", "Approved", "Rejected"]),
  raised: z.number().int(),
});

export const changeRow = z.object({
  date: z.string(),
  id: z.string(),
  user: z.string(),
  from: z.string(),
  to: z.string(),
});

const store = (deps: QueryDeps): QueryDeps => ({ ...deps, config: deps.config ?? readConfigStore() });

export async function readMigrations(deps: QueryDeps = {}): Promise<MigrationsResponse> {
  const { rows } = await query(
    {
      name: "migrations",
      /* From the lakehouse, so a change made a moment ago is not here yet: it
         appears after the next snapshot runs (AD-5). The change log below is
         what shows the user their own action immediately. */
      sql: `SELECT [from], [to], people
            FROM dbo.persona_vw_api_v1_migration
            ORDER BY people DESC`,
      schema: migrationRow,
    },
    deps,
  );
  return rows;
}

export async function readExceptions(deps: QueryDeps = {}): Promise<ExceptionsResponse> {
  const { rows } = await query(
    {
      name: "exceptions",
      /* `raised` is days ago, matching the mock's generator. Nothing in the
         UI reads it today, but the contract asks for a number and days is
         the only reading consistent with the values the mock produces. */
      sql: `SELECT CONVERT(varchar(36), ExceptionId) AS id,
                   UserId     AS [user],
                   PersonaKey AS persona,
                   AppName    AS app,
                   Reason     AS reason,
                   State      AS state,
                   DATEDIFF(day, RaisedUtc, SYSUTCDATETIME()) AS raised
            FROM dbo.persona_app_exception
            ORDER BY RaisedUtc DESC`,
      schema: exceptionRow,
    },
    store(deps),
  );
  return rows;
}

export async function readPersonaChanges(deps: QueryDeps = {}): Promise<PersonaChangesResponse> {
  const { rows } = await query(
    {
      name: "persona-changes",
      /* Style 120 truncated to 16 characters is "YYYY-MM-DD HH:MM", the exact
         shape the mock produces, so the change log reads the same either way. */
      sql: `SELECT CONVERT(varchar(16), RequestedUtc, 120) AS [date],
                   DeviceId        AS id,
                   UserDisplayName AS [user],
                   FromPersonaKey  AS [from],
                   ToPersonaKey    AS [to]
            FROM dbo.persona_change
            ORDER BY RequestedUtc DESC`,
      schema: changeRow,
    },
    store(deps),
  );
  return rows;
}

app.http("change-migrations", {
  route: "change/migrations",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("migrations", () => readMigrations()),
});

app.http("change-exceptions", {
  route: "change/exceptions",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("exceptions", () => readExceptions()),
});

app.http("persona-changes-list", {
  route: "persona-changes",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("persona changes", () => readPersonaChanges()),
});
