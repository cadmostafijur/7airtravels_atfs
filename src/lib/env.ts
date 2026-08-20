import "server-only";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isSimulationAllowed(): boolean {
  if (process.env.SIMULATION_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production") {
    return process.env.ALLOW_SIMULATION_IN_PRODUCTION === "true";
  }
  return true;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "7 Air Travels ATFS",
  timezone: process.env.APP_TIMEZONE ?? process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Dhaka",
  databaseUrl: required("DATABASE_URL", "postgresql://atfs:atfs@localhost:5432/atfs?schema=public"),
  sessionSecret: required("SESSION_SECRET", "dev-only-change-me-session-secret-32ch"),
  workerPort: Number(process.env.WORKER_PORT ?? 3001),
  workerInternalSecret: process.env.WORKER_INTERNAL_SECRET ?? "dev-internal-secret",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001",
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS ?? 30000),
  enableRealtimeDeviceEvents: process.env.ENABLE_REALTIME_DEVICE_EVENTS === "true",
  deviceAdapter: (process.env.DEVICE_ADAPTER ?? "mock") as "k50a" | "mock",
  k50a: {
    ip: process.env.K50A_IP ?? "192.168.1.201",
    port: Number(process.env.K50A_PORT ?? 4370),
    timeoutMs: Number(process.env.K50A_TIMEOUT_MS ?? 10000),
    commKey: Number(process.env.K50A_COMM_KEY ?? 0),
    location: process.env.K50A_LOCATION ?? "Main Office",
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? "console",
    apiUrl: process.env.SMS_API_URL ?? "",
    apiKey: process.env.SMS_API_KEY ?? "",
    senderId: process.env.SMS_SENDER_ID ?? "7AIR",
    type: process.env.SMS_TYPE ?? "text",
    method: (process.env.SMS_API_METHOD ?? "POST").toUpperCase(),
    bodyTemplate: process.env.SMS_HTTP_BODY_TEMPLATE ?? "",
    phoneParam: process.env.SMS_HTTP_PHONE_PARAM ?? "number",
    messageParam: process.env.SMS_HTTP_MESSAGE_PARAM ?? "message",
    retryFailed: process.env.SMS_RETRY_FAILED !== "false",
  },
};
