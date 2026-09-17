import { describe, expect, it } from "vitest";
import { SCORING_VERSION } from "./index.ts";

describe("@pfc/scoring", () => {
  it("exposes a version", () => {
    expect(SCORING_VERSION).toBe("0.1.0");
  });
});
