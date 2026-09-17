/* Grades the fleet in the browser: API data + draft baselines → persona models.
   Baseline sliders only change the draft, so re-grading needs no network call. */
import { buildModel, type Baseline, type PersonaId, type PersonaModel } from "@pfc/scoring";
import { useMemo } from "react";
import { useBaselines, useDevices, useExceptions, useMigrations, usePersonas } from "../api/queries.ts";
import { useUi } from "../store/ui.ts";

export interface FleetModel {
  model: PersonaModel[] | undefined;
  /** Effective baselines: draft where edited, default otherwise. */
  baselines: Record<PersonaId, Baseline> | undefined;
  defaults: Record<PersonaId, Baseline> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useFleetModel(): FleetModel {
  const personas = usePersonas();
  const baselines = useBaselines();
  const devices = useDevices();
  const migrations = useMigrations();
  const exceptions = useExceptions();
  const drafts = useUi((s) => s.draftBaselines);

  const queries = [personas, baselines, devices, migrations, exceptions];
  const error = queries.find((q) => q.error)?.error ?? null;

  const effective = useMemo(
    () => (baselines.data ? { ...baselines.data.defaults, ...drafts } : undefined),
    [baselines.data, drafts],
  );

  const model = useMemo(() => {
    if (
      !personas.data ||
      !baselines.data ||
      !devices.data ||
      !migrations.data ||
      !exceptions.data ||
      !effective
    ) {
      return undefined;
    }
    return buildModel({
      personas: personas.data,
      devicesByPersona: devices.data,
      baselines: effective,
      weights: baselines.data.weights,
      migrations: migrations.data,
      exceptions: exceptions.data,
    });
  }, [personas.data, baselines.data, devices.data, migrations.data, exceptions.data, effective]);

  return {
    model,
    baselines: effective,
    defaults: baselines.data?.defaults,
    isLoading: !model && !error,
    error,
  };
}
