import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    name: "web",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    /* The guided tour is hidden in the product until its script is rewritten
       against real data, but its behaviour is still covered: the tests keep
       running so the feature does not rot while it waits. */
    env: { VITE_SHOW_TOUR: "true" },
  },
});
