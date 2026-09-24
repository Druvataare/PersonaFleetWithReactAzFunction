/* GET /api/catalog — the per-persona application contract, the two Switch
   page figures, and the ticket and request vocabularies.

   Three different grains — persona, persona x app, category — so three
   queries rather than one join that would repeat every persona row once per
   app and leave the mapper to undo it. They run together: nothing here
   depends on anything else here. */
import { app } from "@azure/functions";
import type { CatalogResponse } from "@pfc/contract";
import type { PersonaId } from "@pfc/scoring";
import { z } from "zod";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";

export const catalogPersonaRow = z.object({
  id: z.string(),
  tasksAutomated: z.number().int(),
  onboardingDays: z.number().int(),
});
export const personaAppRow = z.object({ personaId: z.string(), app: z.string() });
export const ticketCategoryRow = z.object({ kind: z.string(), name: z.string() });

export type CatalogRows = {
  personas: z.infer<typeof catalogPersonaRow>[];
  apps: z.infer<typeof personaAppRow>[];
  categories: z.infer<typeof ticketCategoryRow>[];
};

/** Folds the three row sets into the one response, ordering preserved. */
export function buildCatalog({ personas, apps, categories }: CatalogRows): CatalogResponse {
  const appsByPersona: Record<PersonaId, string[]> = {};
  const tasksAutomated: Record<PersonaId, number> = {};
  const onboardingDays: Record<PersonaId, number> = {};

  /* Every persona gets an entry even with no catalogue apps, so the Switch
     page renders an empty list rather than reading undefined. */
  for (const p of personas) {
    appsByPersona[p.id] = [];
    tasksAutomated[p.id] = p.tasksAutomated;
    onboardingDays[p.id] = p.onboardingDays;
  }
  for (const a of apps) appsByPersona[a.personaId]?.push(a.app);

  return {
    apps: appsByPersona,
    tasksAutomated,
    onboardingDays,
    ticketCategories: categories.filter((c) => c.kind === "inc").map((c) => c.name),
    catalogItems: categories.filter((c) => c.kind === "req").map((c) => c.name),
  };
}

export async function readCatalog(deps: QueryDeps = {}): Promise<CatalogResponse> {
  const [personas, apps, categories] = await Promise.all([
    query(
      {
        name: "catalog.personas",
        sql: `SELECT id, tasksAutomated, onboardingDays
              FROM dbo.persona_vw_api_v1_persona
              ORDER BY sortOrder`,
        schema: catalogPersonaRow,
      },
      deps,
    ),
    query(
      {
        name: "catalog.apps",
        sql: `SELECT personaId, app
              FROM dbo.persona_vw_api_v1_persona_app
              ORDER BY personaId, sortOrder`,
        schema: personaAppRow,
      },
      deps,
    ),
    query(
      {
        name: "catalog.categories",
        sql: `SELECT kind, name
              FROM dbo.persona_vw_api_v1_ticket_category
              ORDER BY kind, sortOrder`,
        schema: ticketCategoryRow,
      },
      deps,
    ),
  ]);

  return buildCatalog({ personas: personas.rows, apps: apps.rows, categories: categories.rows });
}

app.http("catalog", {
  route: "catalog",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("catalog", () => readCatalog()),
});
