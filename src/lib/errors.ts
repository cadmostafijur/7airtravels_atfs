export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class DeviceError extends AppError {
  constructor(message: string, public causeName?: string, status = 502) {
    super(message, status, "DEVICE_ERROR");
    this.name = "DeviceError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized", status = 401) {
    super(message, status, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED")) return "Connection refused. Check IP, port, and LAN reachability.";
    if (error.message.includes("TIMEOUT") || error.message.includes("timed out") || error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
      return "Connection timed out. Close K50A menus (home screen), keep Ethernet connected, then retry Sync. Timeout is 60 seconds.";
    }
    if (error.message.includes("ENETUNREACH") || error.message.includes("EHOSTUNREACH")) {
      return "Host unreachable. Confirm the device is on the same LAN or VPN.";
    }
    if (error.message.includes("EINVAL") || error.message.includes("Invalid")) {
      return "Invalid connection parameters.";
    }
    if (error.message.includes("subarray")) {
      return "K50A sent an unexpected data packet while reading logs. Connection may work — try Read users / Test connection. Attendance packet format may differ on this firmware.";
    }
    return error.message;
  }

  // node-zklib ZKError is a plain object, not Error
  if (error && typeof error === "object") {
    const record = error as {
      toast?: () => string;
      getError?: () => { err?: { message?: unknown; code?: unknown }; command?: unknown };
      err?: { message?: unknown; code?: unknown };
      message?: unknown;
    };
    try {
      if (typeof record.toast === "function") {
        const toasted = record.toast();
        if (toasted) return toasted;
      }
    } catch {
      // ignore
    }
    const nested =
      (record.err && typeof record.err === "object" && record.err.message
        ? String(record.err.message)
        : null) ||
      (record.message ? String(record.message) : null);
    if (nested?.includes("subarray")) {
      return "K50A sent an unexpected data packet while reading logs. Try Test connection, then Sync again.";
    }
    if (nested) return nested;
  }

  return "An unexpected error occurred.";
}
