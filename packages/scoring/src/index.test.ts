import { describe, expect, it } from "vitest";
import * as scoring from "./index.ts";

describe("@pfc/scoring public API", () => {
  it("exposes a version", () => {
    expect(scoring.SCORING_VERSION).toBe("0.2.0");
  });

  it("exports every rule the app depends on", () => {
    for (const name of [
      "scoreDevice",
      "deviceScore",
      "buildModel",
      "buildPersonaModel",
      "fitClass",
      "fitByPersona",
      "cpuTier",
      "healthTone",
      "healthLabel",
      "confBand",
      "complianceTone",
      "ticketStatus",
      "gradeTicketLoad",
      "switchMetrics",
      "securityRisk",
    ]) {
      expect(typeof (scoring as Record<string, unknown>)[name], name).toBe("function");
    }
  });
});
