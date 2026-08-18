import "server-only";

import { prisma } from "@/lib/prisma";
import { createDeviceAdapter } from "@/lib/devices/factory";
import { probeTcp } from "@/lib/devices/tcp-probe";
import type { DeviceAdapter, DeviceAttendanceLog, DeviceInfo, DeviceUser } from "@/lib/devices/types";
import { publicErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Device, Prisma } from "@prisma/client";

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
  const adapter = createDeviceAdapter(device.adapterType, {
    ipAddress: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeoutMs,
    commKey: device.commKey,
  });
  await adapter.connect();
  try {
    await prisma.device.update({
      where: { id: device.id },
      data: { status: "ONLINE", lastConnectedAt: new Date(), lastError: null },
    });
    return await fn(adapter);
  } finally {
    await adapter.disconnect();
  }
}

export async function testDeviceConnection(device: Device) {
  const started = Date.now();
  const tcp = await probeTcp(device.ipAddress, device.port, device.timeoutMs);
  await commLog(device.id, "TCP_PROBE", tcp.ok, tcp.ok ? `TCP open in ${tcp.latencyMs}ms` : tcp.error ?? "TCP failed", {
    ...tcp,
  });

  if (!tcp.ok) {
    await prisma.device.update({
      where: { id: device.id },
      data: { status: "OFFLINE", lastError: tcp.error ?? "TCP probe failed" },
    });
    return {
      tcp,
      protocol: null as null,
      info: null as DeviceInfo | null,
      connected: false,
      elapsedMs: Date.now() - started,
      message: tcp.error ?? "TCP probe failed",
    };
  }

  try {
    const info = await withDevice(device, async (adapter) => adapter.getDeviceInfo());
    await commLog(device.id, "TEST_CONNECTION", true, "K50A protocol handshake succeeded", { info });
    return {
      tcp,
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
    await prisma.device.update({
      where: { id: device.id },
      data: { status: "OFFLINE", lastError: message },
    });
    return {
      tcp,
      protocol: null,
      info: null,
      connected: false,
      elapsedMs: Date.now() - started,
      message: `TCP is reachable, but the ZK protocol handshake failed: ${message}`,
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
