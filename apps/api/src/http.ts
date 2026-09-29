/* Turning a reader into an HTTP response, the same way for every endpoint.

   Two things every endpoint owes the caller. A failure must arrive as JSON
   matching ApiError, never a stack trace: the browser shows the message, and
   a stack tells an attacker about our schema while telling the user nothing.
   And it must carry a correlation id, so a report of "it broke" can be found
   in Application Insights — the host's invocationId already is one, so there
   is nothing to generate. The detail goes to the log, the id goes to the
   caller, and the two meet again in the trace. */
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { ApiError } from "@pfc/contract";
import { callerFrom, NotAuthenticatedError } from "./change/identity.ts";

/* Reference data changes when someone edits policy or a pipeline runs, not
   between requests. Five minutes keeps the Personas page instant on
   navigation without making a baseline edit feel broken. Step 10 revisits
   this with the rest of the caching story. */
const REFERENCE_MAX_AGE_SEC = 300;

/* `read` receives the request so parameterised endpoints can reach the query
   string. Handlers that ignore it keep passing `() => readThing()`, which
   still satisfies this type — a function may always take fewer arguments
   than its caller supplies. */
export function readerHandler<T>(
  name: string,
  read: (request: HttpRequest) => Promise<T>,
): (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit> {
  return async (request, context) => {
    try {
      /* Reads authenticate for themselves rather than trusting the gateway.
         staticwebapp.config.json does reject anonymous callers at the edge,
         but that is another application's configuration file, and the only
         thing stopping a direct call to this Function App is the "Azure
         Static Web Apps (Linked)" identity provider — which the Functions
         docs warn against deleting precisely because losing it exposes the
         app. Without this check, losing it would serve the whole fleet,
         including user names and email addresses, to anyone who resolved the
         hostname, while the writes carried on refusing. That asymmetry is
         what this closes. */
      callerFrom(request);
      return {
        status: 200,
        jsonBody: await read(request),
        headers: { "Cache-Control": `public, max-age=${REFERENCE_MAX_AGE_SEC}` },
      };
    } catch (error) {
      if (error instanceof NotAuthenticatedError) {
        return {
          status: 401,
          jsonBody: { error: error.message } satisfies ApiError,
          headers: { "Cache-Control": "no-store" },
        };
      }
      /* The whole error, including its cause chain, goes to the log only. */
      context.error(`${name} failed`, error);
      const body: ApiError = { error: `${name} is unavailable (reference ${context.invocationId})` };
      return { status: 500, jsonBody: body, headers: { "Cache-Control": "no-store" } };
    }
  };
}
