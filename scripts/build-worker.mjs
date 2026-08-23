/**
 * Bundle the ATFS worker for production (Windows service / plain node).
 * Keeps native packages external (@prisma/client, node-zklib, etc.).
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, "dist", "atfs-worker.mjs");

await esbuild.build({
  entryPoints: [path.join(root, "src/server/worker.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile,
  sourcemap: true,
  packages: "external",
  alias: {
    "@": path.join(root, "src"),
    "server-only": path.join(root, "scripts/empty-module.cjs"),
  },
  logLevel: "info",
});

console.log(`Worker bundle written to ${outfile}`);
