import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { LiveAttendanceEvent } from "@/lib/realtime/events";

export async function publishAttendance(event: LiveAttendanceEvent) {
  const url = `http://127.0.0.1:${env.workerPort}/internal/events`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": env.workerInternalSecret,
      },
      body: JSON.stringify({ type: "attendance:new", payload: event }),
    });
    if (!response.ok) {
      logger.warn("realtime_publish_failed", { status: response.status });
    }
  } catch (error) {
    logger.warn("realtime_worker_unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
