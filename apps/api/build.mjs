/* Bundles the Functions app into dist/index.js.
   Only first-party code is bundled: our own src/ plus the two workspace
   packages (@pfc/contract, @pfc/scoring), which are safe because we wrote
   them and they contain nothing dynamic. Every real npm dependency stays
   external instead of being bundled — @azure/functions, @azure/identity and
   mssql all contain dynamic require() patterns deep in their dependency
   trees (jsonwebtoken -> jws -> safe-buffer, @azure/functions' own worker
   interop) that esbuild cannot statically resolve; bundling them anyway
   leaves broken relative-path requires baked into the output that only
   happen to resolve when the full monorepo node_modules sits alongside
   (which is why this looked fine locally and failed the moment dist/ was
   copied out on its own — confirmed 22 Sep 2026).
   prepare-deploy.mjs installs the same external packages for real into a
   standalone deploy/ folder, so both files read "external" the same way:
   every dependency in package.json except the workspace ones. */
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@pfc/"));

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  sourcemap: true,
  external,
  logLevel: "info",
});
