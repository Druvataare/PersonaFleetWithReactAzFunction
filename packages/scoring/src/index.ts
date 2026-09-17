/* @pfc/scoring — business rules ported from the Persona Fleet Command wireframe.
   Pure functions, no runtime dependencies. Shared by the web app and the API. */
export const SCORING_VERSION = "0.2.0";

export * from "./types.ts";
export { clamp, mean, sum } from "./math.ts";
export { complianceTone, confBand, cpuTier, healthLabel, healthTone } from "./bands.ts";
export type { ConfidenceBand } from "./bands.ts";
export { deviceScore, scoreDevice } from "./device.ts";
export { buildModel, buildPersonaModel, personaHealth, supportScore } from "./persona.ts";
export type { FleetInput, PersonaInput } from "./persona.ts";
export { FIT_KINDS, fitByPersona, fitClass } from "./fit.ts";
export type { FitKind, PersonaFit } from "./fit.ts";
export { gradeTicketLoad, ticketBaselinePerUser, ticketStatus } from "./tickets.ts";
export type { TicketGrade, TicketStatusLabel } from "./tickets.ts";
export { RISK_RANK, securityRisk, switchMetrics } from "./switch.ts";
export type { RiskLevel, SwitchContext, SwitchMetrics } from "./switch.ts";
