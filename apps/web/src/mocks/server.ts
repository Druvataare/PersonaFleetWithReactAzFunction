/* Node-side mock API for tests. */
import { setupServer } from "msw/node";
import { handlers } from "./handlers.ts";

export const server = setupServer(...handlers);
