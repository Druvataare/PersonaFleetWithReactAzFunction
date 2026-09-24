/* GET /api/personas — the six personas and their headcounts. The Personas
   page draws one ring per row, so this is the first real data in the browser. */
import { app } from "@azure/functions";
import type { PersonasResponse } from "@pfc/contract";
import { z } from "zod";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readerHandler } from "../http.ts";

/* The view already aliases every column to the PersonaDef field it feeds
   (AD-18), so this schema is the contract type restated for the row —
   a renamed column fails here, naming the field, rather than arriving as
   undefined and being drawn as a zero-size ring. */
export const personaRow = z.object({
  id: z.string(),
  name: z.string(),
  sub: z.string(),
  count: z.number().int(),
  hue: z.string(),
});

export async function readPersonas(deps: QueryDeps = {}): Promise<PersonasResponse> {
  const { rows } = await query(
    {
      name: "personas",
      /* sortOrder decides display order but is not part of the contract, so
         it sorts here and is dropped rather than shipped. */
      sql: `SELECT id, name, sub, [count], hue
            FROM dbo.persona_vw_api_v1_persona
            ORDER BY sortOrder`,
      schema: personaRow,
    },
    deps,
  );
  return rows;
}

app.http("personas", {
  route: "personas",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("personas", () => readPersonas()),
});
