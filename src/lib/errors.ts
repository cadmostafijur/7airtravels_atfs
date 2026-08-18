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
    if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
      return "Connection timed out. The K50A may be offline or the port is blocked.";
    }
    if (error.message.includes("ENETUNREACH") || error.message.includes("EHOSTUNREACH")) {
      return "Host unreachable. Confirm the device is on the same LAN or VPN.";
    }
    if (error.message.includes("EINVAL") || error.message.includes("Invalid")) {
      return "Invalid connection parameters.";
    }
  }
  return "An unexpected error occurred.";
}
