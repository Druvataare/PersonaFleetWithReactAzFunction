/* GET /api/mapping/summary and /api/mapping/review — how confidently each job
   title was placed into a persona, and the queue of the ones worth a human
   look (AD-16).

   Both read the same grain view and both reduce it with the shared functions
   from @pfc/contract, so a band total here and a band total in the mock come
   from one implementation. */
import { app, type HttpRequest } from "@azure/functions";
import {
  mappingReview,
  mappingSummary,
  type MappingReviewResponse,
  type MappingSummary,
} from "@pfc/contract";
import { readPersonas } from "../reference/personas.ts";
import { readerHandler } from "../http.ts";
import type { QueryDeps } from "../fabric/query.ts";
import { readTitleRows } from "./rows.ts";

/** Absent and blank are the same thing: "no filter", not a filter on "". */
const param = (request: HttpRequest, name: string): string | null => {
  const value = request.query.get(name)?.trim();
  return value ? value : null;
};

export async function readMappingSummary(
  persona: string | null,
  deps: QueryDeps = {},
): Promise<MappingSummary> {
  /* mappingSummary needs the personas to order and label byPersona, so the
     two reads go together rather than one after the other. */
  const [rows, personas] = await Promise.all([readTitleRows(deps), readPersonas(deps)]);
  return mappingSummary(rows, personas, persona);
}

export async function readMappingReview(
  persona: string | null,
  band: string | null,
  q: string | null,
  deps: QueryDeps = {},
): Promise<MappingReviewResponse> {
  const rows = await readTitleRows(deps);
  /* The 150-row cap and "everything below 100% when no band is given" both
     live in mappingReview; this endpoint only supplies the parameters. */
  return mappingReview(rows, persona, band, q);
}

app.http("mapping-summary", {
  route: "mapping/summary",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("mapping summary", (request) => readMappingSummary(param(request, "persona"))),
});

app.http("mapping-review", {
  route: "mapping/review",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: readerHandler("mapping review", (request) =>
    readMappingReview(param(request, "persona"), param(request, "band"), param(request, "q")),
  ),
});
