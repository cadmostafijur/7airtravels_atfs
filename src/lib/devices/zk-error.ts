import "server-only";

/**
 * node-zklib throws ZKError plain objects (not Error instances).
 * Normalize those so API/UI show a real message instead of "[object Object]".
 */
export function extractDeviceErrorMessage(error: unknown, fallback = "Device communication failed"): string {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;

  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      err?: { message?: unknown; code?: unknown } | string;
      command?: unknown;
      ip?: unknown;
      getError?: () => { err?: { message?: unknown; code?: unknown }; command?: unknown; ip?: unknown };
      toast?: () => string;
    };

    if (typeof record.toast === "function") {
      try {
        const toasted = record.toast();
        if (toasted) return toasted;
      } catch {
        // ignore
      }
    }

    if (typeof record.getError === "function") {
      try {
        const details = record.getError();
        const nested = details.err?.message ? String(details.err.message) : "";
        const code = details.err?.code ? String(details.err.code) : "";
        const command = details.command ? String(details.command) : "";
        const parts = [nested || code, command].filter(Boolean);
        if (parts.length) return parts.join(" · ");
      } catch {
        // ignore
      }
    }

    if (record.err && typeof record.err === "object" && record.err.message) {
      return String(record.err.message);
    }
    if (typeof record.err === "string" && record.err) return record.err;
    if (record.message) return String(record.message);
  }

  if (typeof error === "string") return error;
  return fallback;
}
