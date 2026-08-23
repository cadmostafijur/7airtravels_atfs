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

function smsConfig() {
  return {
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
    maxPunchAgeMinutes: Number(process.env.SMS_MAX_PUNCH_AGE_MINUTES ?? 60),
  };
}

/** Lazy reads so worker dotenv (loaded before this module) and Next.js env both work. */
export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get appName() {
    return process.env.NEXT_PUBLIC_APP_NAME ?? "7 Air Travels ATFS";
  },
  get timezone() {
    return process.env.APP_TIMEZONE ?? process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Dhaka";
  },
  get databaseUrl() {
    return required("DATABASE_URL", "postgresql://atfs:atfs@localhost:5432/atfs?schema=public");
  },
  get sessionSecret() {
    return required("SESSION_SECRET", "dev-only-change-me-session-secret-32ch");
  },
  get workerPort() {
    return Number(process.env.WORKER_PORT ?? 3001);
  },
  /**
   * Interface the worker binds to. Defaults to all interfaces so an office LAN
   * deployment can serve Socket.IO to other machines directly. On the VPS set
   * WORKER_HOST=127.0.0.1 — nginx is the only thing that should reach it.
   */
  get workerHost() {
    return process.env.WORKER_HOST ?? "0.0.0.0";
  },
  get workerInternalSecret() {
    return process.env.WORKER_INTERNAL_SECRET ?? "dev-internal-secret";
  },
  get socketUrl() {
    return process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
  },
  get syncIntervalMs() {
    return Number(process.env.SYNC_INTERVAL_MS ?? 30000);
  },
  get enableRealtimeDeviceEvents() {
    return process.env.ENABLE_REALTIME_DEVICE_EVENTS === "true";
  },
  get deviceAdapter() {
    return (process.env.DEVICE_ADAPTER ?? "mock") as "k50a" | "mock";
  },
  get k50a() {
    return {
      ip: process.env.K50A_IP ?? "192.168.1.201",
      port: Number(process.env.K50A_PORT ?? 4370),
      timeoutMs: Number(process.env.K50A_TIMEOUT_MS ?? 60000),
      commKey: Number(process.env.K50A_COMM_KEY ?? 0),
      location: process.env.K50A_LOCATION ?? "Main Office",
    };
  },
  get sms() {
    return smsConfig();
  },
};
