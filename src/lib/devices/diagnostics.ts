import "server-only";

import { prisma } from "@/lib/prisma";
import { createDeviceAdapter } from "@/lib/devices/factory";
import { acquireDeviceLock, isDeviceBusy } from "@/lib/devices/device-lock";
import type { DeviceAdapter, DeviceAttendanceLog, DeviceInfo, DeviceUser } from "@/lib/devices/types";
import { DeviceError, publicErrorMessage } from "@/lib/errors";
import { extractDeviceErrorMessage } from "@/lib/devices/zk-error";
import { logger } from "@/lib/logger";
import type { Device, Prisma } from "@prisma/client";

/** Website/VPS cannot reach the office K50A — only the LAN worker may mark OFFLINE. */
async function markDeviceOffline(deviceId: string, message: string) {
  if (isDeviceBusy(new Error(message))) return;
  if (process.env.ATFS_IS_WORKER !== "true") {
    logger.warn("skip_offline_status_from_web", {
      deviceId,
      message,
      hint: "K50A is LAN-only. Office worker status is the source of truth.",
    });
    return;
  }
  await prisma.device.update({
    where: { id: deviceId },
    data: { status: "OFFLINE", lastError: message },
  });
}

async function commLog(
  deviceId: string,
  action: string,
  success: boolean,
  message: string,
  details?: Record<string, unknown>,
) {
  await prisma.deviceCommLog.create({
    data: { deviceId, action, success, message, details: details as Prisma.InputJsonValue | undefined },
  });
}

export async function withDevice<T>(
  device: Device,
  fn: (adapter: DeviceAdapter) => Promise<T>,
): Promise<T> {
  const timeoutMs = Math.max(device.timeoutMs || 0, 60_000);
  if (device.timeoutMs < 60_000) {
    device = await prisma.device.update({
      where: { id: device.id },
      data: { timeoutMs: 60_000 },
    });
  }

  const lock = device.adapterType === "mock" ? null : await acquireDeviceLock(device.ipAddress);
  const adapter = createDeviceAdapter(device.adapterType, {
    ipAddress: device.ipAddress,
    port: device.port,
    timeoutMs,
    commKey: device.commKey,
  });
  try {
    try {
      await adapter.connect();
    } catch (error) {
      if (!isDeviceBusy(error)) {
        const message = extractDeviceErrorMessage(error, publicErrorMessage(error));
        await markDeviceOffline(device.id, message);
      }
      throw error;
    }
    try {
      await prisma.device.update({
        where: { id: device.id },
        data: { status: "ONLINE", lastConnectedAt: new Date(), lastError: null },
      });
      return await fn(adapter);
    } finally {
      await adapter.disconnect();
    }
  } finally {
    await lock?.release();
  }
}

export async function testDeviceConnection(device: Device) {
  const started = Date.now();
  try {
    const info = await withDevice(device, async (adapter) => adapter.getDeviceInfo());
    const elapsedMs = Date.now() - started;
    await commLog(device.id, "TEST_CONNECTION", true, "K50A protocol handshake succeeded", { info });
    return {
      tcp: {
        ok: true,
        ipAddress: device.ipAddress,
        port: device.port,
        latencyMs: elapsedMs,
        diagnosis: "ok" as const,
      },
      protocol: info.protocol ?? "unknown",
      info,
      connected: true,
      elapsedMs: Date.now() - started,
      message:
        device.adapterType === "mock"
          ? "Simulation device connected. This is not a physical K50A."
          : "K50A connected successfully.",
    };
  } catch (error) {
    const message = publicErrorMessage(error);
    logger.error("device_test_failed", { deviceId: device.id, message });
    await commLog(device.id, "TEST_CONNECTION", false, message);
    if (!isDeviceBusy(error)) await markDeviceOffline(device.id, message);
    return {
      tcp: {
        ok: false,
        ipAddress: device.ipAddress,
        port: device.port,
        latencyMs: Date.now() - started,
        error: message,
        diagnosis: isDeviceBusy(error) ? ("busy" as const) : ("no_reply" as const),
        hint: isDeviceBusy(error)
          ? "Another sync already has the only connection. The terminal is still online."
          : "The terminal did not answer. It allows only one connection. Wait for the current sync to finish, and confirm the terminal is powered on at this IP.",
      },
      protocol: null,
      info: null,
      connected: false,
      elapsedMs: Date.now() - started,
      message,
    };
  }
}

export async function readDeviceUsers(device: Device): Promise<DeviceUser[]> {
  const users = await withDevice(device, (adapter) => adapter.getUsers());
  await commLog(device.id, "GET_USERS", true, `Read ${users.length} users`);
  return users;
}

export async function readDeviceAttendance(device: Device): Promise<DeviceAttendanceLog[]> {
  const logs = await withDevice(device, (adapter) => adapter.getAttendanceLogs());
  await commLog(device.id, "GET_ATTENDANCE", true, `Read ${logs.length} transactions`);
  return logs;
}

export async function readDeviceInfo(device: Device): Promise<DeviceInfo> {
  const info = await withDevice(device, (adapter) => adapter.getDeviceInfo());
  await commLog(device.id, "GET_INFO", true, "Read device information", { info });
  return info;
}
