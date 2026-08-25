import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncDeviceAttendance } from "@/lib/attendance/sync";
import { probeTcp } from "@/lib/devices/tcp-probe";
import type { LiveAttendanceEvent } from "@/lib/realtime/events";

const syncing = new Set<string>();

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
    select: { id: true, name: true, ipAddress: true, port: true, adapterType: true, status: true, lastSyncAt: true },
  });
  return Promise.all(
    devices.map(async (device) => {
      if (device.adapterType === "mock") {
        return { ...device, reachable: true, diagnosis: "ok" as const, hint: undefined, latencyMs: 0 };
      }
      const probe = await probeTcp(device.ipAddress, device.port, 8000);
      return {
        ...device,
        reachable: probe.ok,
        diagnosis: probe.diagnosis,
        hint: probe.hint,
        latencyMs: probe.latencyMs,
      };
    }),
  );
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
  for (const device of devices) {
    if (syncing.has(device.id)) continue;
    syncing.add(device.id);
    try {
      const result = await syncDeviceAttendance(device.id);
      lastSyncOk = true;
      lastSyncError = null;
      logger.info("scheduled_sync", { deviceId: device.id, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastSyncOk = false;
      lastSyncError = message;
      logger.warn("scheduled_sync_failed", { deviceId: device.id, error: message });
    } finally {
      syncing.delete(device.id);
    }
  }
}

async function main() {
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

  await syncAllDevices();
  setInterval(() => {
    void syncAllDevices();
  }, env.syncIntervalMs);
}

void main().catch((error) => {
  logger.error("worker_crash", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
