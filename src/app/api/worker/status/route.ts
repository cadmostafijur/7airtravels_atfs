import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";

/** Whether the office sync worker is reachable (required for auto SMS after fingerprint). */
export async function GET(request: Request) {
  try {
    await requireApiSession(request, "dashboard");
    const url = `http://127.0.0.1:${env.workerPort}/health`;
    let online = false;
    let detail: string | null = null;
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) });
      online = response.ok;
      if (!online) detail = `Worker HTTP ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : "Worker not reachable";
    }
    return jsonOk({
      online,
      port: env.workerPort,
      syncIntervalMs: env.syncIntervalMs,
      detail,
      hint: online
        ? "Worker is running — fingerprints sync automatically and SMS can send."
        : "Start worker on this PC: npm run start:worker (keep this window open).",
    });
  } catch (error) {
    return jsonError(error);
  }
}
