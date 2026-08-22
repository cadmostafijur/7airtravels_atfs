/** Allow ATFS worker (tsx) to import Next "server-only" modules + load .env early. */
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  // dotenv may be nested under prisma; ignore if missing — Prisma may still load later
}

const Module = require("module");
const original = Module.prototype.require;
Module.prototype.require = function stubServerOnly(id) {
  if (id === "server-only") return {};
  return original.apply(this, arguments);
};
