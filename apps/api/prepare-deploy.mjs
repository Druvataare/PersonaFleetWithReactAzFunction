/* Builds apps/api/deploy: a self-contained folder ready to zip and deploy.
   dist/index.js (CommonJS — see build.mjs) bundles our own code and the two
   workspace packages, but every real npm dependency (@azure/functions,
   @azure/identity, mssql, zod) stays external. In an npm-workspaces monorepo those
   are hoisted to the repo root's node_modules, so a deploy of just apps/api
   on its own has no ancestor node_modules to find them in — they have to
   travel with the package. Rather than hand-copy them and guess at their own
   transitive dependencies, this runs a real `npm install` in a fresh
   directory outside the workspace (so npm treats it as an ordinary
   standalone project, with no workspace hoisting to fight), producing a
   complete, guaranteed-correct node_modules for exactly the dependencies
   deploy/package.json declares.
   Run after `npm run build`. Idempotent: deploy/ is wiped and rebuilt each time. */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = Object.fromEntries(
  Object.entries(pkg.dependencies).filter(([name]) => !name.startsWith("@pfc/")),
);

rmSync("deploy", { recursive: true, force: true });
mkdirSync("deploy");
cpSync("dist", "deploy/dist", { recursive: true });
cpSync("host.json", "deploy/host.json");
writeFileSync(
  "deploy/package.json",
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: "dist/index.js",
      dependencies: external,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Installing ${Object.keys(external).join(", ")} into deploy/ (outside the workspace)...`);
execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: "deploy",
  stdio: "inherit",
  shell: process.platform === "win32",
});

console.log("deploy/ is ready — host.json, package.json, dist/, node_modules/ (self-contained)");
