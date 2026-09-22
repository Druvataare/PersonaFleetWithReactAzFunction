/* Bundles the Functions app into dist/index.js as CommonJS.
   Every real npm dependency stays external: @azure/functions, @azure/identity
   and mssql all contain dynamic require() patterns deep in their trees
   (jsonwebtoken -> jws -> safe-buffer, @azure/functions' own worker interop)
   that esbuild cannot statically resolve; bundling them anyway leaves broken
   relative-path requires baked into the output (confirmed 22 Sep 2026).
   Only first-party code is bundled: our own src/ plus the two workspace
   packages (@pfc/contract, @pfc/scoring), which contain nothing dynamic.
   prepare-deploy.mjs installs the external packages for real into a
   standalone deploy/ folder, so both files read "external" the same way.
   CJS rather than ESM: with the packages above external, esbuild's CJS output
   needs no require-shim interop for them at all, which is the exact mechanism
   that produced the broken requires above. Plain .js with no "type": "module"
   is also the form every Functions v4 doc example uses for the `main` field,
   so it is the best-trodden path for the worker's entry-point resolution.
   ES modules are supported by Functions and were not proven to be the cause of
   the empty-function-list problem — see backend.md for that investigation. */
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@pfc/"));

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/index.js",
  sourcemap: true,
  external,
  logLevel: "info",
});
