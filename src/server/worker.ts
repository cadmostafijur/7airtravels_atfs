import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncDeviceAttendance } from "@/lib/attendance/sync";
import type { LiveAttendanceEvent } from "@/lib/realtime/events";

const syncing = new Set<string>();
/** Consecutive failed cycles. A dead K50A was being dialed every 45s (tens of thousands of connects), which freezes these terminals so new punches never upload. */
let failureStreak = 0;

const OFFICE_END_MINUTES = 19 * 60;
const CATCHUP_FROM_MINUTES = 17 * 60;

function dhakaClock(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

/** Full device read already stored for this Dhaka date. */
let fullSyncDate: string | null = null;

function nextDelayMs() {
  const clock = dhakaClock();
  const beforeClose = clock.minutes < OFFICE_END_MINUTES;
  const base = Math.max(env.syncIntervalMs, 15_000);
  if (beforeClose && failureStreak > 0) return 60_000;
  if (failureStreak <= 0) return beforeClose ? base : 5 * 60 * 1000;
  return Math.min(base * 2 ** Math.min(failureStreak, 5), 10 * 60 * 1000);
}

function needsFullSync(clock = dhakaClock()) {
  if (fullSyncDate === clock.date) return false;
  return clock.minutes >= CATCHUP_FROM_MINUTES && clock.minutes < OFFICE_END_MINUTES;
}

/** Last completed sync attempt, so /health can report tunnel state without polling the device. */
let lastSyncAt: Date | null = null;
let lastSyncOk = false;
let lastSyncError: string | null = null;

/**
 * Live reachability of every configured device across the VPN tunnel.
 * Used by /health/devices so an uptime check catches a dropped tunnel before
 * anyone notices missing attendance SMS.
 */
async function deviceReachability() {
  const devices = await prisma.device.findMany({
    select: { id: true, name: true, ipAddress: true, port: true, adapterType: true, status: true, lastSyncAt: true, lastError: true },
  });
  return devices.map((device) => ({
    ...device,
    reachable: device.adapterType === "mock" || device.status === "ONLINE",
    diagnosis: device.status === "ONLINE" ? "ok" : "no_reply",
    hint: device.lastError,
  }));
}

async function syncAllDevices() {
  let devices;
  try {
    devices = await prisma.device.findMany();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastSyncAt = new Date();
    lastSyncOk = false;
    lastSyncError = message;
    logger.warn("scheduled_sync_db_unavailable", { error: message });
    return;
  }
  lastSyncAt = new Date();
  let anyOk = false;
  let anyFailed = false;
  let requestedFull = false;
  for (const device of devices) {
    if (syncing.has(device.id)) continue;
    syncing.add(device.id);
    try {
      const full = needsFullSync();
      if (full) requestedFull = true;
      const result = await syncDeviceAttendance(device.id, { full });
      if (full && result.status !== "SUCCESS") anyFailed = true;
      anyOk = true;
      lastSyncOk = true;
      lastSyncError = null;
      logger.info("scheduled_sync", { deviceId: device.id, full, ...result });
    } catch (error) {
      anyFailed = true;
      const message = error instanceof Error ? error.message : String(error);
      lastSyncOk = false;
      lastSyncError = message;
      logger.warn("scheduled_sync_failed", { deviceId: device.id, error: message });
    } finally {
      syncing.delete(device.id);
    }
  }
  if (requestedFull && anyOk && !anyFailed) fullSyncDate = dhakaClock().date;
  if (devices.length === 0 || (anyOk && !anyFailed)) failureStreak = 0;
  else if (anyFailed) failureStreak += 1;
}

function scheduleSync() {
  void syncAllDevices().finally(() => {
    const delayMs = nextDelayMs();
    if (failureStreak > 0) {
      logger.info("scheduled_sync_backoff", { failureStreak, delayMs });
    }
    setTimeout(scheduleSync, delayMs);
  });
}

async function main() {
  process.env.ATFS_IS_WORKER = "true";

  const io = new Server({
    cors: {
      origin: env.appUrl,
      credentials: true,
    },
  });

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "atfs-worker",
          uptimeSeconds: Math.round(process.uptime()),
          lastSyncAt: lastSyncAt?.toISOString() ?? null,
          lastSyncOk,
          lastSyncError,
          deadline: "19:00 Asia/Dhaka",
          fullSyncDate,
          dhaka: dhakaClock(),
        }),
      );
      return;
    }

    // Deeper check: actually touches the K50A across the VPN. Returns 503 when
    // no device is reachable so an uptime monitor can alert on a dead tunnel.
    if (req.method === "GET" && req.url === "/health/devices") {
      try {
        const devices = await deviceReachability();
        const healthy = devices.length > 0 && devices.every((d) => d.reachable);
        res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: healthy, devices }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/internal/events") {
      const secret = req.headers["x-internal-secret"];
      if (secret !== env.workerInternalSecret) {
        res.writeHead(401);
        res.end("unauthorized");
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          type: string;
          payload: LiveAttendanceEvent;
        };
        io.emit(body.type, body.payload);
        res.writeHead(204);
        res.end();
      } catch {
        res.writeHead(400);
        res.end("invalid");
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  io.attach(server);
  io.on("connection", (socket) => {
    logger.info("socket_connected", { id: socket.id });
  });

  server.listen(env.workerPort, env.workerHost, () => {
    logger.info("worker_listening", { host: env.workerHost, port: env.workerPort });
  });

  scheduleSync();
}

void main().catch((error) => {
  logger.error("worker_crash", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
