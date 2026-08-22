/**
 * Restore ATFS-patched node-zklib TCP transport after npm install.
 */
const fs = require("node:fs");
const path = require("node:path");

const dest = path.join(__dirname, "..", "node_modules", "node-zklib", "zklibtcp.js");
const src = path.join(__dirname, "..", "patches", "node-zklib-zklibtcp.js");

if (!fs.existsSync(path.dirname(dest))) {
  console.warn("[patch-node-zklib] node-zklib missing; skip");
  process.exit(0);
}
if (!fs.existsSync(src)) {
  console.warn("[patch-node-zklib] patches/node-zklib-zklibtcp.js missing; skip");
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log("[patch-node-zklib] restored patched zklibtcp.js");
