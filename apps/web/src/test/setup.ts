import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { resetDb } from "../mocks/db.ts";
import { server } from "../mocks/server.ts";

/* Every web test talks to the same mock API the browser uses. */
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(async () => {
  if (typeof window === "undefined") return;
  window.localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  /* Tests read final numbers, so start with motion off (the store is reset per test). */
  const { useUi } = await import("../store/ui.ts");
  useUi.setState({ motion: false, chartNames: false, theme: "midnight", draftBaselines: {} });
  useUi.getState().resetFilters();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
});

afterAll(() => server.close());
