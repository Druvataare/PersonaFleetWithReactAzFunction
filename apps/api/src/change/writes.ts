/* POST /api/persona-changes and /api/devices/:id/provisioning-requests —
   the two places the portal stops being read-only.

   Both write to the SQL database, never the lakehouse (AD-5), both record
   the caller from their Entra identity rather than from the body, and both
   are safe to send twice. */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import type {
  ApiError,
  PersonaChange,
  PersonaChangeRequest,
  PersonaChangeResponse,
  ProvisioningRequestResponse,
} from "@pfc/contract";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readConfigStore } from "../fabric/config.ts";
import { query, type QueryDeps } from "../fabric/query.ts";
import { readPersonas } from "../reference/personas.ts";
import { callerFrom, NotAuthenticatedError, type Caller } from "./identity.ts";

/** A request that names its own fault, so the handler can answer with it. */
export class BadRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "BadRequestError";
  }
}

const store = (deps: QueryDeps): QueryDeps => ({ ...deps, config: deps.config ?? readConfigStore() });

/* Idempotency without a key from the client.

   The contract is frozen and neither POST carries one, so a key has to be
   derived. Content alone is not enough: moving a user to Engineering, away,
   and back is three legitimate changes, and the first and third would hash
   identically. A coarse time bucket separates them while still collapsing
   the case this actually protects against, a double submit arriving within
   seconds.

   So this is de-duplication over a window, not true idempotency, and the
   difference is worth stating: two identical requests either side of a
   bucket boundary will both be recorded. The real fix is the client sending
   an Idempotency-Key, which is honoured here when present and which a future
   contract revision should require. */
const BUCKET_MS = 60_000;

export function idempotencyKey(request: HttpRequest, parts: string[], now = Date.now()): string {
  const supplied = request.headers.get("idempotency-key")?.trim();
  if (supplied) return supplied.slice(0, 64);
  const bucket = Math.floor(now / BUCKET_MS);
  return createHash("sha256")
    .update([...parts, bucket].join("|"))
    .digest("hex")
    .slice(0, 64);
}

const deviceOwnerRow = z.object({
  id: z.string(),
  userId: z.string(),
  user: z.string(),
  personaId: z.string(),
});

const changeRow = z.object({
  date: z.string(),
  id: z.string(),
  user: z.string(),
  from: z.string(),
  to: z.string(),
});

/** The device, its owner and its current persona — or a 404 naming it. */
async function readDeviceOwner(deviceId: string, deps: QueryDeps) {
  const { rows } = await query(
    {
      name: "device-owner",
      sql: "SELECT id, userId, [user], personaId FROM dbo.persona_vw_api_v1_device WHERE id = @deviceId",
      params: { deviceId },
      schema: deviceOwnerRow,
    },
    deps,
  );
  if (!rows.length) throw new BadRequestError(`Device ${deviceId} not found`, 404);
  return rows[0];
}

/* Insert then read back, with a duplicate key swallowed. The unique index on
   IdempotencyKey decides the race, so a second submit takes the CATCH and
   both callers read the one row that exists. Returning the stored row rather
   than the one we meant to write is the point: the response is identical
   however many times the request is sent. */
const INSERT_CHANGE = `BEGIN TRY
  INSERT INTO dbo.persona_change
    (UserId, UserDisplayName, DeviceId, FromPersonaKey, ToPersonaKey, RequestedBy, IdempotencyKey)
  VALUES (@userId, @userName, @deviceId, @fromPersona, @toPersona, @by, @key);
END TRY
BEGIN CATCH
  IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
END CATCH;
SELECT CONVERT(varchar(16), RequestedUtc, 120) AS [date],
       DeviceId        AS id,
       UserDisplayName AS [user],
       FromPersonaKey  AS [from],
       ToPersonaKey    AS [to]
FROM dbo.persona_change
WHERE IdempotencyKey = @key;`;

export async function applyPersonaChange(
  body: Partial<PersonaChangeRequest> | null,
  caller: Caller,
  key: string,
  deps: QueryDeps = {},
): Promise<PersonaChange> {
  /* The contract calls this userId, but the Switch page sends the device id
     (apply.mutate({ userId: device.id, to })). Named accurately here rather
     than carrying the contract's wording inward. */
  const deviceId = body?.userId?.trim();
  const to = body?.to?.trim();
  if (!deviceId || !to) throw new BadRequestError("userId and to are required");

  const [device, personas] = await Promise.all([readDeviceOwner(deviceId, deps), readPersonas(deps)]);
  const target = personas.find((p) => p.id === to);
  if (!target) throw new BadRequestError(`Unknown persona ${to}`);
  if (device.personaId === to) throw new BadRequestError(`User is already in ${target.name}`);

  const { rows } = await query(
    {
      name: "persona-change-insert",
      sql: INSERT_CHANGE,
      params: {
        userId: device.userId,
        userName: device.user,
        deviceId: device.id,
        fromPersona: device.personaId,
        toPersona: to,
        by: caller.name,
        key,
      },
      schema: changeRow,
    },
    store(deps),
  );
  if (!rows.length) throw new Error("persona_change insert produced no row");
  return rows[0];
}

/* Where a provisioning request is routed. There is no source for this in the
   estate — no ITSM, no routing table — so it is a stated constant rather than
   a measurement, named here so it is obvious it was chosen and not derived
   (AD-10). It matches what the mock returns, so the page reads the same. */
export const ASSIGNMENT_GROUP = "EUC-Provisioning";

const INSERT_REQUEST = `BEGIN TRY
  INSERT INTO dbo.persona_provisioning_request
    (DeviceId, AssignmentGroup, RequestedBy, IdempotencyKey)
  VALUES (@deviceId, @grp, @by, @key);
END TRY
BEGIN CATCH
  IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
END CATCH;
SELECT RequestNumber AS number, AssignmentGroup AS [group]
FROM dbo.persona_provisioning_request
WHERE IdempotencyKey = @key;`;

export async function raiseProvisioningRequest(
  deviceId: string,
  caller: Caller,
  key: string,
  deps: QueryDeps = {},
): Promise<ProvisioningRequestResponse> {
  await readDeviceOwner(deviceId, deps);

  const { rows } = await query(
    {
      name: "provisioning-request-insert",
      sql: INSERT_REQUEST,
      params: { deviceId, grp: ASSIGNMENT_GROUP, by: caller.name, key },
      schema: z.object({ number: z.string(), group: z.string() }),
    },
    store(deps),
  );
  if (!rows.length) throw new Error("persona_provisioning_request insert produced no row");
  return rows[0];
}

/** Shared shape for the two writes: authenticate, act, or answer with why not. */
function writeHandler<T>(
  name: string,
  write: (request: HttpRequest, caller: Caller) => Promise<T>,
): (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit> {
  return async (request, context) => {
    const headers = { "Cache-Control": "no-store" };
    try {
      const caller = callerFrom(request);
      return { status: 201, jsonBody: await write(request, caller), headers };
    } catch (error) {
      if (error instanceof NotAuthenticatedError) {
        return { status: 401, jsonBody: { error: error.message } satisfies ApiError, headers };
      }
      if (error instanceof BadRequestError) {
        /* The caller's own mistake, so the message is useful and safe: it
           names a persona or a device the caller already supplied. */
        return { status: error.status, jsonBody: { error: error.message } satisfies ApiError, headers };
      }
      context.error(`${name} failed`, error);
      const body: ApiError = { error: `${name} failed (reference ${context.invocationId})` };
      return { status: 500, jsonBody: body, headers };
    }
  };
}

app.http("persona-changes-create", {
  route: "persona-changes",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: writeHandler("persona change", async (request, caller) => {
    const body = (await request.json().catch(() => null)) as Partial<PersonaChangeRequest> | null;
    const key = idempotencyKey(request, ["persona-change", caller.id, body?.userId ?? "", body?.to ?? ""]);
    const change = await applyPersonaChange(body, caller, key);
    return { change } satisfies PersonaChangeResponse;
  }),
});

app.http("provisioning-requests-create", {
  route: "devices/{deviceId}/provisioning-requests",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: writeHandler("provisioning request", async (request, caller) => {
    const deviceId = request.params.deviceId;
    const key = idempotencyKey(request, ["provisioning", caller.id, deviceId]);
    return raiseProvisioningRequest(deviceId, caller, key);
  }),
});
