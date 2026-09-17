import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/test/**", "**/main.tsx", "**/vite-env.d.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
