import "server-only";

import { createRequire } from "node:module";
import { DeviceError } from "@/lib/errors";
import { extractDeviceErrorMessage } from "@/lib/devices/zk-error";
import type {
  DeviceAdapter,
  DeviceAttendanceLog,
  DeviceConnectionConfig,
  DeviceInfo,
  DeviceStatusSnapshot,
  DeviceUser,
} from "@/lib/devices/types";

const require = createRequire(import.meta.url);

/** K50A attendance dumps are often slow on LAN; 10s is too short for node-zklib. */
const DEFAULT_TIMEOUT_MS = 60_000;

type ZKLibInstance = {
  createSocket: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  getInfo: () => Promise<{ userCounts?: number; logCounts?: number; logCapacity?: number }>;
  getUsers: () => Promise<{ data?: unknown[] } | unknown[]>;
  getAttendances: (cb?: unknown) => Promise<{ data?: unknown[] } | unknown[]>;
  enableDevice?: () => Promise<unknown>;
  disableDevice?: () => Promise<unknown>;
  clearAttendanceLog?: () => Promise<unknown>;
  freeData?: () => Promise<unknown>;
  connectionType?: string | null;
  zklibTcp?: {
    timeout?: number;
    getAttendances?: (cb?: unknown) => Promise<{ data?: unknown; err?: unknown }>;
    getUsers?: () => Promise<{ data?: unknown; err?: unknown }>;
    requestData?: (msg: unknown) => Promise<unknown>;
    __atfsPatched?: boolean;
  };
  zklibUdp?: { timeout?: number };
};

function loadZKLib(): new (ip: string, port: number, timeout: number, inport: number) => ZKLibInstance {
  try {
    const mod = require("node-zklib") as { default?: unknown } | (new (...args: never[]) => ZKLibInstance);
    return (typeof mod === "function" ? mod : (mod as { default: unknown }).default) as new (
      ip: string,
      port: number,
      timeout: number,
      inport: number,
    ) => ZKLibInstance;
  } catch (error) {
    throw new DeviceError(
      "node-zklib could not be loaded. The K50A adapter is isolated and can be replaced.",
      error instanceof Error ? error.message : "load",
    );
  }
}

function asArray(result: { data?: unknown[] } | unknown[]): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { data?: unknown[] }).data)) {
    return (result as { data: unknown[] }).data;
  }
  return [];
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function wrapZkError(error: unknown, action: string): DeviceError {
  const detail = extractDeviceErrorMessage(error);
  if (/TIMEOUT/i.test(detail)) {
    return new DeviceError(
      `${action}: device timed out while sending data. Keep the K50A idle (close menus), confirm IP/port, then retry. Timeout is now ${DEFAULT_TIMEOUT_MS / 1000}s.`,
      detail,
      504,
    );
  }
  if (/subarray/i.test(detail)) {
    return new DeviceError(
      `${action}: K50A returned an empty or unexpected packet. Try again with the device on the home screen.`,
      detail,
    );
  }
  return new DeviceError(`${action}: ${detail}`, detail);
}

function isTimeoutError(error: unknown): boolean {
  return /TIMEOUT/i.test(extractDeviceErrorMessage(error));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Harden node-zklib TCP helpers:
 * - empty attendance/user payloads should not crash on .subarray(null)
 * - swallow late timer rejections that become unhandledRejection
 */
function patchZkTcpSafety(zk: ZKLibInstance, timeoutMs: number) {
  if (zk.zklibTcp) zk.zklibTcp.timeout = timeoutMs;
  if (zk.zklibUdp) zk.zklibUdp.timeout = timeoutMs;

  const tcp = zk.zklibTcp;
  if (!tcp || tcp.__atfsPatched) return;

  if (typeof tcp.getAttendances === "function") {
    const original = tcp.getAttendances.bind(tcp);
    tcp.getAttendances = async (cb?: unknown) => {
      try {
        const result = await original(cb);
        if (!result?.data) return { data: [], err: result?.err ?? null };
        if (!Buffer.isBuffer(result.data) && !(result.data instanceof Uint8Array)) {
          return { data: [], err: null };
        }
        return result;
      } catch (error) {
        const detail = extractDeviceErrorMessage(error);
        if (/subarray/i.test(detail)) return { data: [], err: null };
        throw error;
      }
    };
  }

  if (typeof tcp.getUsers === "function") {
    const originalUsers = tcp.getUsers.bind(tcp);
    tcp.getUsers = async () => {
      try {
        const result = await originalUsers();
        if (!result?.data) return { data: [], err: result?.err ?? null };
        if (!Buffer.isBuffer(result.data) && !(result.data instanceof Uint8Array) && !Array.isArray(result.data)) {
          return { data: [], err: null };
        }
        return result;
      } catch (error) {
        const detail = extractDeviceErrorMessage(error);
        if (/subarray/i.test(detail)) return { data: [], err: null };
        throw error;
      }
    };
  }

  tcp.__atfsPatched = true;
}

/**
 * K50AAdapter — ZK binary protocol via node-zklib (TCP, UDP fallback).
 * VERIFICATION STATUS: physical K50A still firmware-sensitive; this file is replaceable.
 */
export class K50AAdapter implements DeviceAdapter {
  readonly name = "K50AAdapter";
  readonly verificationStatus = "unverified" as const;
  private zk: ZKLibInstance | null = null;
  private connected = false;
  private readonly timeoutMs: number;

  constructor(private readonly config: DeviceConnectionConfig) {
    this.timeoutMs = Math.max(config.timeoutMs ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  }

  async connect(): Promise<void> {
    const ZKLib = loadZKLib();
    this.zk = new ZKLib(this.config.ipAddress, this.config.port, this.timeoutMs, 4000);
    patchZkTcpSafety(this.zk, this.timeoutMs);
    try {
      await this.zk.createSocket();
      this.connected = true;
      // Warm-up: some K50A firmwares need getInfo before bulk attendance read.
      try {
        await this.zk.getInfo();
      } catch {
        // connect still counts if socket is up
      }
    } catch (error) {
      this.connected = false;
      this.zk = null;
      throw wrapZkError(error, `K50A handshake failed at ${this.config.ipAddress}:${this.config.port}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.zk) {
      this.connected = false;
      return;
    }
    try {
      await this.zk.disconnect();
    } catch {
      // ignore
    } finally {
      this.zk = null;
      this.connected = false;
    }
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const zk = this.requireConnected();
    try {
      const info = await zk.getInfo();
      return {
        model: "K50A",
        serialNumber: null,
        userCount: info.userCounts,
        logCount: info.logCounts,
        logCapacity: info.logCapacity,
        protocol: zk.connectionType ?? "tcp",
        connected: this.connected,
        extra: { ...info, library: "node-zklib", verifiedOnK50A: false, timeoutMs: this.timeoutMs },
      };
    } catch (error) {
      throw wrapZkError(error, "Get device info failed");
    }
  }

  async getUsers(): Promise<DeviceUser[]> {
    const zk = this.requireConnected();
    try {
      const rows = asArray(await this.withRetry(() => zk.getUsers(), "Read users"));
      return rows.map((row) => {
        const record = (row ?? {}) as Record<string, unknown>;
        const userId = String(pick(record, ["userId", "userid", "uid", "id"]) ?? "");
        return {
          uid: (pick(record, ["uid", "uidNumber"]) as number | string) ?? userId,
          userId,
          name: String(pick(record, ["name", "userName"]) ?? userId),
          role: pick(record, ["role"]) as number | string | undefined,
          cardno: pick(record, ["cardno", "cardNo"]) as string | number | undefined,
        };
      });
    } catch (error) {
      throw wrapZkError(error, "Read users failed");
    }
  }

  async createUser(): Promise<void> {
    throw new DeviceError(
      "User enrollment on the physical K50A is not implemented in this adapter. Enroll fingerprints on the terminal and map deviceUserId in the application.",
      "not_implemented",
      501,
    );
  }

  async updateUser(): Promise<void> {
    throw new DeviceError(
      "Updating K50A users from this adapter is not implemented until verified on the physical device.",
      "not_implemented",
      501,
    );
  }

  async deleteUser(): Promise<void> {
    throw new DeviceError(
      "Deleting K50A users from this adapter is not implemented until verified on the physical device.",
      "not_implemented",
      501,
    );
  }

  async getAttendanceLogs(): Promise<DeviceAttendanceLog[]> {
    const zk = this.requireConnected();
    try {
      const rows = asArray(await this.withRetry(() => zk.getAttendances(), "Read attendance"));
      return rows
        .map((row) => this.normalizeLog((row ?? {}) as Record<string, unknown>))
        .filter((row): row is DeviceAttendanceLog => row !== null);
    } catch (error) {
      const detail = extractDeviceErrorMessage(error);
      // Soft-recover: empty/timeout/subarray should not hard-crash Sync when TCP is up.
      if (/TIMEOUT|subarray|EMPTY_REPLY|UNHANDLE_CMD/i.test(detail)) {
        return [];
      }
      throw wrapZkError(error, "Read attendance logs failed");
    }
  }

  async getDeviceStatus(): Promise<DeviceStatusSnapshot> {
    if (!this.connected || !this.zk) {
      return {
        reachable: false,
        connected: false,
        message: "Not connected",
        checkedAt: new Date(),
      };
    }
    try {
      const info = await this.zk.getInfo();
      return {
        reachable: true,
        connected: true,
        protocol: this.zk.connectionType ?? "tcp",
        message: `Connected. Users: ${info.userCounts ?? "n/a"}, logs: ${info.logCounts ?? "n/a"}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        reachable: false,
        connected: false,
        message: extractDeviceErrorMessage(error, "Status check failed"),
        checkedAt: new Date(),
      };
    }
  }

  async clearAttendanceLogs(): Promise<void> {
    const zk = this.requireConnected();
    if (!zk.clearAttendanceLog) {
      throw new DeviceError("Clear attendance is not available in the loaded library.", "not_supported", 501);
    }
    await zk.disableDevice?.();
    try {
      await zk.clearAttendanceLog();
    } finally {
      await zk.enableDevice?.();
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isTimeoutError(error) || attempt === 3) break;
        await sleep(1500 * attempt);
      }
    }
    throw wrapZkError(lastError, label);
  }

  private requireConnected(): ZKLibInstance {
    if (!this.zk || !this.connected) {
      throw new DeviceError("K50A is not connected.", "not_connected", 409);
    }
    return this.zk;
  }

  private normalizeLog(record: Record<string, unknown>): DeviceAttendanceLog | null {
    const deviceUserId = String(
      pick(record, ["deviceUserId", "userId", "userid", "uid", "user_id"]) ?? "",
    );
    const timestamp = toDate(pick(record, ["recordTime", "attTime", "timestamp", "time"]));
    if (!deviceUserId || !timestamp) return null;
    return {
      deviceUserId,
      timestamp,
      verificationMethod: "FINGERPRINT",
      attendanceType: "UNKNOWN",
      deviceTransactionId: null,
      raw: record,
    };
  }
}
