import "server-only";

import { createRequire } from "node:module";
import { DeviceError } from "@/lib/errors";
import type {
  DeviceAdapter,
  DeviceAttendanceLog,
  DeviceConnectionConfig,
  DeviceInfo,
  DeviceStatusSnapshot,
  DeviceUser,
} from "@/lib/devices/types";

const require = createRequire(import.meta.url);

type ZKLibInstance = {
  createSocket: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  getInfo: () => Promise<{ userCounts?: number; logCounts?: number; logCapacity?: number }>;
  getUsers: () => Promise<{ data?: unknown[] } | unknown[]>;
  getAttendances: () => Promise<{ data?: unknown[] } | unknown[]>;
  enableDevice?: () => Promise<unknown>;
  disableDevice?: () => Promise<unknown>;
  clearAttendanceLog?: () => Promise<unknown>;
  connectionType?: string | null;
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

/**
 * K50AAdapter
 *
 * Candidate transport: ZK binary protocol via node-zklib over TCP (then UDP fallback).
 * Default ZKTeco standalone port is 4370 — this is configurable, never assumed at the UI layer.
 *
 * VERIFICATION STATUS: UNVERIFIED against a physical ZKTeco K50A.
 * If this library cannot speak to the actual firmware, replace this file only.
 * Attendance business logic does not import node-zklib.
 */
export class K50AAdapter implements DeviceAdapter {
  readonly name = "K50AAdapter";
  readonly verificationStatus = "unverified" as const;
  private zk: ZKLibInstance | null = null;
  private connected = false;

  constructor(private readonly config: DeviceConnectionConfig) {}

  async connect(): Promise<void> {
    const ZKLib = loadZKLib();
    this.zk = new ZKLib(
      this.config.ipAddress,
      this.config.port,
      this.config.timeoutMs ?? 10000,
      4000,
    );
    try {
      await this.zk.createSocket();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      this.zk = null;
      throw new DeviceError(
        `K50A handshake failed at ${this.config.ipAddress}:${this.config.port}. TCP may succeed while the ZK protocol fails — this adapter is replaceable.`,
        error instanceof Error ? error.message : "connect",
      );
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
      // Always clear local state even if the device already dropped the socket.
    } finally {
      this.zk = null;
      this.connected = false;
    }
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const zk = this.requireConnected();
    const info = await zk.getInfo();
    return {
      model: "K50A",
      serialNumber: null,
      userCount: info.userCounts,
      logCount: info.logCounts,
      logCapacity: info.logCapacity,
      protocol: zk.connectionType ?? "tcp",
      connected: this.connected,
      extra: { ...info, library: "node-zklib", verifiedOnK50A: false },
    };
  }

  async getUsers(): Promise<DeviceUser[]> {
    const zk = this.requireConnected();
    const rows = asArray(await zk.getUsers());
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
  }

  async createUser(): Promise<void> {
    throw new DeviceError(
      "User enrollment on the physical K50A is not implemented in this adapter. Enroll fingerprints on the terminal and map deviceUserId in the application. Do not invent undocumented K50A write APIs.",
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
    const rows = asArray(await zk.getAttendances());
    return rows
      .map((row) => this.normalizeLog((row ?? {}) as Record<string, unknown>))
      .filter((row): row is DeviceAttendanceLog => row !== null);
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
        message: error instanceof Error ? error.message : "Status check failed",
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
