/* TanStack Query hooks, one per endpoint. Mutations invalidate what they change. */
import type { PersonaId } from "@pfc/scoring";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client.ts";
import type {
  BaselinesResponse,
  CatalogResponse,
  DevicesResponse,
  ExceptionsResponse,
  MappingReviewResponse,
  MappingSummary,
  MigrationsResponse,
  PersonaChangeRequest,
  PersonaChangeResponse,
  PersonaChangesResponse,
  PersonasResponse,
  ProvisioningRequestResponse,
  TicketKind,
  TicketSummary,
} from "@pfc/contract";

const qs = (params: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const queryKeys = {
  personas: ["personas"] as const,
  baselines: ["baselines"] as const,
  catalog: ["catalog"] as const,
  devices: ["fleet", "devices"] as const,
  mappingSummary: (persona: string) => ["mapping", "summary", persona] as const,
  mappingReview: (persona: string, band: string | null, q: string) =>
    ["mapping", "review", persona, band, q] as const,
  tickets: (kind: TicketKind, persona: string, cat: string | null) =>
    ["tickets", kind, persona, cat] as const,
  migrations: ["change", "migrations"] as const,
  exceptions: ["change", "exceptions"] as const,
  personaChanges: ["persona-changes"] as const,
};

export const usePersonas = () =>
  useQuery({ queryKey: queryKeys.personas, queryFn: () => apiGet<PersonasResponse>("/api/personas") });

export const useBaselines = () =>
  useQuery({
    queryKey: queryKeys.baselines,
    queryFn: () => apiGet<BaselinesResponse>("/api/baselines"),
    staleTime: Infinity,
  });

export const useCatalog = () =>
  useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => apiGet<CatalogResponse>("/api/catalog"),
    staleTime: Infinity,
  });

export const useDevices = () =>
  useQuery({ queryKey: queryKeys.devices, queryFn: () => apiGet<DevicesResponse>("/api/fleet/devices") });

export const useMappingSummary = (persona: PersonaId | "all") =>
  useQuery({
    queryKey: queryKeys.mappingSummary(persona),
    queryFn: () => apiGet<MappingSummary>(`/api/mapping/summary${qs({ persona })}`),
    placeholderData: keepPreviousData,
  });

export const useMappingReview = (persona: PersonaId | "all", band: string | null, q: string) =>
  useQuery({
    queryKey: queryKeys.mappingReview(persona, band, q),
    queryFn: () => apiGet<MappingReviewResponse>(`/api/mapping/review${qs({ persona, band, q })}`),
    placeholderData: keepPreviousData,
  });

export const useTicketSummary = (kind: TicketKind, persona: PersonaId | "all", cat: string | null) =>
  useQuery({
    queryKey: queryKeys.tickets(kind, persona, cat),
    queryFn: () => apiGet<TicketSummary>(`/api/tickets/summary${qs({ type: kind, persona, cat })}`),
    placeholderData: keepPreviousData,
  });

export const useMigrations = () =>
  useQuery({
    queryKey: queryKeys.migrations,
    queryFn: () => apiGet<MigrationsResponse>("/api/change/migrations"),
  });

export const useExceptions = () =>
  useQuery({
    queryKey: queryKeys.exceptions,
    queryFn: () => apiGet<ExceptionsResponse>("/api/change/exceptions"),
  });

export const usePersonaChanges = () =>
  useQuery({
    queryKey: queryKeys.personaChanges,
    queryFn: () => apiGet<PersonaChangesResponse>("/api/persona-changes"),
  });

/** Moving a user changes headcounts, sample devices, migrations and the change log. */
export function useApplyPersonaChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PersonaChangeRequest) => apiPost<PersonaChangeResponse>("/api/persona-changes", body),
    onSuccess: () =>
      Promise.all(
        [
          queryKeys.personas,
          queryKeys.devices,
          queryKeys.migrations,
          queryKeys.personaChanges,
          ["mapping"],
          ["tickets"],
        ].map((queryKey) => qc.invalidateQueries({ queryKey })),
      ),
  });
}

export const useRaiseProvisioningRequest = () =>
  useMutation({
    mutationFn: (deviceId: string) =>
      apiPost<ProvisioningRequestResponse>(
        `/api/devices/${encodeURIComponent(deviceId)}/provisioning-requests`,
      ),
  });
