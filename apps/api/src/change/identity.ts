/* Who is asking, taken from the request rather than from the request body.

   Static Web Apps puts the signed-in user in `x-ms-client-principal` as
   base64 JSON when it proxies to a linked backend. Microsoft's own note on
   this is the reason the check below exists: "While the API does receive
   user-identifiable information, it does not perform its own checks if the
   user is authenticated or if they match a required role." The routes file
   guards the pages; nothing guards these endpoints but this.
   https://learn.microsoft.com/azure/static-web-apps/user-information

   Trusting a header is only safe because nothing can reach this app without
   passing through the Static Web App: linking adds an "Azure Static Web Apps
   (Linked)" identity provider that rejects traffic from anywhere else. If
   that provider is ever removed, this becomes forgeable, which is exactly
   why the Functions doc warns against deleting it. */
import type { HttpRequest } from "@azure/functions";

export interface Caller {
  /** Username or email, per the client principal's userDetails. */
  name: string;
  /** The Static Web Apps user id — stable per app, not a directory object id. */
  id: string;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Sign-in required");
    this.name = "NotAuthenticatedError";
  }
}

/** The caller, or throws. Writes must never fall back to an anonymous name. */
export function callerFrom(request: HttpRequest): Caller {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) throw new NotAuthenticatedError();
  let principal: { userDetails?: unknown; userId?: unknown };
  try {
    principal = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as typeof principal;
  } catch {
    /* A malformed header is not an anonymous caller; it is a broken one. */
    throw new NotAuthenticatedError();
  }
  const name = typeof principal.userDetails === "string" ? principal.userDetails.trim() : "";
  const id = typeof principal.userId === "string" ? principal.userId.trim() : "";
  if (!name) throw new NotAuthenticatedError();
  return { name, id };
}
