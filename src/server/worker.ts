import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncDeviceAttendance } from "@/lib/attendance/sync";
import type { LiveAttendanceEvent } from "@/lib/realtime/events";

const syncing = new Set<string>();

async function syncAllDevices() {
  const devices = await prisma.device.findMany();
  for (const device of devices) {
    if (syncing.has(device.id)) continue;
    syncing.add(device.id);
    try {
      const result = await syncDeviceAttendance(device.id);
      logger.info("scheduled_sync", { deviceId: device.id, ...result });
    } catch (error) {
      logger.warn("scheduled_sync_failed", {
        deviceId: device.id,
        error: error instanceof Error ? error.message : String(error),
      });
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
      res.end(JSON.stringify({ ok: true, service: "atfs-worker" }));
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

  server.listen(env.workerPort, () => {
    logger.info("worker_listening", { port: env.workerPort });
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
