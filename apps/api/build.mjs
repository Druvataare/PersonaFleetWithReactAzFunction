/* Bundles the Functions app into dist/index.js.
   Bundling is what makes workspace packages (@pfc/contract, @pfc/scoring) work
   once deployed: Azure installs only this app's own dependencies, and would
   never resolve a sibling workspace. @azure/functions stays external because
   the host provides it. */
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  sourcemap: true,
  external: ["@azure/functions"],
  logLevel: "info",
});
