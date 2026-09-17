/* Mock Service Worker handlers for the /api/* contract in the architecture.
   Paths start with "*" so they match on any origin (browser, tests, previews). */
import { http, HttpResponse, type DefaultBodyType, type PathParams } from "msw";
import type {
  ApiError,
  BaselinesResponse,
  CatalogResponse,
  DevicesResponse,
  ExceptionsResponse,
  MappingReviewResponse,
  MappingSummary,
  MigrationsResponse,
  PersonaChange,
  PersonaChangeRequest,
  PersonaChangeResponse,
  PersonaChangesResponse,
  PersonasResponse,
  ProvisioningRequestResponse,
  TicketKind,
  TicketSummary,
} from "../api/types.ts";
import { mappingReview, mappingSummary, ticketSummary } from "./aggregate.ts";
import { CATALOG, TICKET_CATS } from "./data/catalog.ts";
import { db } from "./db.ts";

const bad = (status: number, error: string) => HttpResponse.json<ApiError>({ error }, { status });

const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

export const handlers = [
  http.get("*/api/personas", () => HttpResponse.json<PersonasResponse>(db().personas)),

  http.get("*/api/baselines", () => {
    const { defaultBaselines, weights } = db();
    return HttpResponse.json<BaselinesResponse>({ defaults: defaultBaselines, weights });
  }),

  http.get("*/api/catalog", () => {
    const { apps, tasksAutomated, onboardingDays } = db();
    return HttpResponse.json<CatalogResponse>({
      apps,
      tasksAutomated,
      onboardingDays,
      ticketCategories: TICKET_CATS,
      catalogItems: CATALOG,
    });
  }),

  http.get("*/api/fleet/devices", () => HttpResponse.json<DevicesResponse>(db().devicesByPersona)),

  http.get("*/api/mapping/summary", ({ request }) => {
    const url = new URL(request.url);
    const { titleRows, personas } = db();
    return HttpResponse.json<MappingSummary>(
      mappingSummary(titleRows, personas, url.searchParams.get("persona")),
    );
  }),

  http.get("*/api/mapping/review", ({ request }) => {
    const p = new URL(request.url).searchParams;
    return HttpResponse.json<MappingReviewResponse>(
      mappingReview(db().titleRows, p.get("persona"), p.get("band"), p.get("q")),
    );
  }),

  http.get<PathParams, DefaultBodyType, TicketSummary | ApiError>("*/api/tickets/summary", ({ request }) => {
    const p = new URL(request.url).searchParams;
    const type = p.get("type") ?? "inc";
    if (type !== "inc" && type !== "req") return bad(400, "type must be inc or req");
    const kind: TicketKind = type;
    const { incidents, requests, personas } = db();
    return HttpResponse.json<TicketSummary>(
      ticketSummary(kind === "inc" ? incidents : requests, personas, kind, p.get("persona"), p.get("cat")),
    );
  }),

  http.get("*/api/change/migrations", () => HttpResponse.json<MigrationsResponse>(db().migrations)),

  http.get("*/api/change/exceptions", () => HttpResponse.json<ExceptionsResponse>(db().exceptions)),

  http.get("*/api/persona-changes", () => HttpResponse.json<PersonaChangesResponse>(db().switches)),

  /* Moves a user's device to another persona: headcounts, migrations and the change log all update. */
  http.post<PathParams, DefaultBodyType, PersonaChangeResponse | ApiError>(
    "*/api/persona-changes",
    async ({ request }) => {
      const body = (await request.json().catch(() => null)) as Partial<PersonaChangeRequest> | null;
      if (!body?.userId || !body.to) return bad(400, "userId and to are required");
      const state = db();
      const target = state.personas.find((p) => p.id === body.to);
      if (!target) return bad(400, `Unknown persona ${body.to}`);
      const from = state.personas.find((p) =>
        state.devicesByPersona[p.id]?.some((d) => d.id === body.userId),
      );
      if (!from) return bad(404, `User ${body.userId} not found`);
      if (from.id === target.id) return bad(400, `User is already in ${target.name}`);

      const device = state.devicesByPersona[from.id].find((d) => d.id === body.userId)!;
      state.devicesByPersona[from.id] = state.devicesByPersona[from.id].filter((d) => d.id !== device.id);
      state.devicesByPersona[target.id].push(device);
      from.count = Math.max(0, from.count - 1);
      target.count += 1;
      const migration = state.migrations.find((m) => m.from === from.id && m.to === target.id);
      if (migration) migration.people++;
      else state.migrations.push({ from: from.id, to: target.id, people: 1 });

      const change: PersonaChange = {
        date: now(),
        id: device.id,
        user: device.user,
        from: from.id,
        to: target.id,
      };
      state.switches.unshift(change);
      return HttpResponse.json<PersonaChangeResponse>({ change }, { status: 201 });
    },
  ),

  http.post<PathParams, DefaultBodyType, ProvisioningRequestResponse | ApiError>(
    "*/api/devices/:did/provisioning-requests",
    ({ params }) => {
      const did = String(params.did);
      const exists = Object.values(db().devicesByPersona).some((list) => list.some((d) => d.id === did));
      if (!exists) return bad(404, `Device ${did} not found`);
      return HttpResponse.json<ProvisioningRequestResponse>(
        { number: "INC00" + Math.floor(50000 + Math.random() * 9000), group: "EUC-Provisioning" },
        { status: 201 },
      );
    },
  ),
];
