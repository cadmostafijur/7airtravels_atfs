import { NextResponse } from "next/server";
import { AppError, publicErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  const status = error instanceof AppError ? error.status : fallbackStatus;
  const message = publicErrorMessage(error);
  if (!(error instanceof AppError) || status >= 500) {
    logger.error("api_error", {
      detail: error instanceof Error ? error.message : publicErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
  return NextResponse.json(
    { ok: false, error: message, code: error instanceof AppError ? error.code : "INTERNAL" },
    { status },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("Invalid JSON body", 400, "INVALID_JSON");
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!origin) return;
  const allowed = new URL(appUrl).origin;
  if (origin !== allowed) {
    throw new AppError("Invalid request origin", 403, "CSRF");
  }
}
