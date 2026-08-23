/**
 * PM2 processes for the ATFS deployment on the 7 Air Travels VPS.
 *
 * The main 7airtravels.com site already owns :3000, so ATFS uses 3010 (web)
 * and 3011 (worker + Socket.IO). Both bind loopback-only; nginx terminates TLS
 * for atfs.7airtravels.com and proxies to them.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "atfs-web",
      cwd: root,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3010 --hostname 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      autorestart: true,
      error_file: path.join(root, "logs", "pm2-web-error.log"),
      out_file: path.join(root, "logs", "pm2-web-out.log"),
      time: true,
    },
    {
      name: "atfs-worker",
      cwd: root,
      // run-worker.cjs loads .env, stubs server-only, then runs dist/atfs-worker.mjs.
      // Build it first with `npm run build:worker`.
      script: "scripts/run-worker.cjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      autorestart: true,
      // The K50A lives behind the VPN; a flapping tunnel must not hot-loop the worker.
      restart_delay: 10000,
      min_uptime: "30s",
      max_restarts: 20,
      error_file: path.join(root, "logs", "pm2-worker-error.log"),
      out_file: path.join(root, "logs", "pm2-worker-out.log"),
      time: true,
    },
  ],
};
