type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, extra?: Record<string, unknown>) => write("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => write("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => write("error", message, extra),
};
