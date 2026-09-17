import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetDb } from "../mocks/db.ts";
import { server } from "../mocks/server.ts";

/* Every web test talks to the same mock API the browser uses. */
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
});
afterAll(() => server.close());
