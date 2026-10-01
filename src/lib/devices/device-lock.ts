import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeviceError } from "@/lib/errors";

function lockPath(ipAddress: string) {
  const safe = ipAddress.replace(/[^\dA-Za-z]+/g, "_");
  return join(tmpdir(), `atfs-k50a-${safe}.lock`);
}

function pidAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function clearStale(path: string) {
  const info = await stat(path).catch(() => null);
  if (!info) return;
  const text = await readFile(path, "utf8").catch(() => "");
  if (!text.trim()) return;
  const pid = Number(text.trim());
  const abandoned = !pidAlive(pid) || Date.now() - info.mtimeMs > 10 * 60 * 1000;
  if (abandoned) await unlink(path).catch(() => {});
}

/** The K50A accepts one TCP session. The website and the worker share this lock. */
export async function acquireDeviceLock(ipAddress: string, waitMs = 90_000) {
  const path = lockPath(ipAddress);
  const started = Date.now();
  while (Date.now() - started < waitMs) {
    try {
      await writeFile(path, String(process.pid), { flag: "wx" });
      return {
        async release() {
          await unlink(path).catch(() => {});
        },
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      await clearStale(path);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new DeviceError(
    "The fingerprint terminal is busy with another sync. It was left online. Wait a moment and try again.",
    "busy",
    503,
  );
}

export function isDeviceBusy(error: unknown) {
  if (error instanceof DeviceError && error.causeName === "busy") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /busy with another sync/i.test(message);
}
