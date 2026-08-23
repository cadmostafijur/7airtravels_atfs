/**
 * Production worker launcher for NSSM / Windows Service.
 * Loads .env from project root, stubs server-only, then runs the bundled worker.
 */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const distWorker = path.join(repoRoot, "dist", "atfs-worker.mjs");

function log(level, message, extra) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

try {
  require("dotenv").config({ path: envPath });
} catch (error) {
  log("error", "worker_launcher_dotenv_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function stubServerOnly(id) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments);
};

log("info", "worker_launcher_start", {
  cwd: process.cwd(),
  repoRoot,
  node: process.version,
  envFile: fs.existsSync(envPath) ? envPath : "missing",
  bundle: fs.existsSync(distWorker) ? distWorker : "missing",
});

if (!fs.existsSync(distWorker)) {
  log("error", "worker_launcher_missing_bundle", {
    hint: "Run npm run build:worker before starting the Windows service.",
  });
  process.exit(1);
}

void (async () => {
  try {
    await import(pathToFileURL(distWorker).href);
  } catch (error) {
    log("error", "worker_launcher_crash", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
})();
