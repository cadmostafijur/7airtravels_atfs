import "server-only";

import type { Attendance, AttendanceSource, Device, Prisma } from "@prisma/client";
import { prisma, withPrisma } from "@/lib/prisma";
import { withDevice } from "@/lib/devices/diagnostics";
import type { DeviceAttendanceLog } from "@/lib/devices/types";
import { processDailySummary } from "@/lib/attendance/process";
import { notifyAttendanceSms } from "@/lib/sms/service";
import { publishAttendance } from "@/lib/realtime/publisher";
import { logger } from "@/lib/logger";
import { extractDeviceErrorMessage } from "@/lib/devices/zk-error";
import { DeviceError, publicErrorMessage } from "@/lib/errors";

export type IngestResult = {
  inserted: Attendance | null;
  skipped: boolean;
  failed?: string;
};

export async function ingestAttendanceLog(input: {
  device: Device;
  log: DeviceAttendanceLog;
  source?: AttendanceSource;
}): Promise<IngestResult> {
  const employee = await prisma.employee.findFirst({
    where: { deviceUserId: String(input.log.deviceUserId) },
  });

  const payload: Prisma.AttendanceUncheckedCreateInput = {
    employeeId: employee?.id,
    deviceId: input.device.id,
    deviceUserId: String(input.log.deviceUserId),
    deviceTransactionId: input.log.deviceTransactionId ?? undefined,
    timestamp: input.log.timestamp,
    attendanceType: input.log.attendanceType ?? "UNKNOWN",
    verificationMethod: input.log.verificationMethod ?? "FINGERPRINT",
    source: input.source ?? "DEVICE",
    rawPayload: input.log.raw as Prisma.InputJsonValue,
  };

  try {
    const inserted = await prisma.attendance.create({ data: payload });
    let summary = null;
    if (employee) {
      summary = await processDailySummary(employee.id, inserted.timestamp);
    }
    void notifyAttendanceSms(inserted, employee, summary).catch((error) => {
      logger.error("sms_after_attendance_failed", { error: String(error) });
    });
    await publishAttendance({
      id: inserted.id,
      employee: employee?.name ?? "Unknown device user",
      employeeCode: employee?.employeeCode ?? null,
      deviceUserId: inserted.deviceUserId,
      timestamp: inserted.timestamp.toISOString(),
      status: summary?.status ?? "UNKNOWN",
      device: input.device.name,
      verificationMethod: inserted.verificationMethod,
    });
    return { inserted, skipped: false };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { inserted: null, skipped: true };
    }
    return {
      inserted: null,
      skipped: false,
      failed: error instanceof Error ? error.message : "insert failed",
    };
  }
}

export async function syncDeviceAttendance(deviceId: string) {
  return withPrisma(async (db) => {
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const syncLog = await db.syncLog.create({
    data: { deviceId, status: "RUNNING" },
  });

  let recordsRead = 0;
  let recordsInserted = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;
  let errorMessage: string | null = null;

  try {
    const logs = await withDevice(device, (adapter) => adapter.getAttendanceLogs());
    recordsRead = logs.length;
    for (const log of logs) {
      const result = await ingestAttendanceLog({ device, log, source: device.adapterType === "mock" ? "SIMULATION" : "DEVICE" });
      if (result.inserted) recordsInserted += 1;
      else if (result.skipped) recordsSkipped += 1;
      else {
        recordsFailed += 1;
        logger.warn("sync_record_failed", { deviceId, error: result.failed });
      }
    }

    const status = recordsFailed > 0 ? "PARTIAL" : "SUCCESS";
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        completedAt: new Date(),
        recordsRead,
        recordsInserted,
        recordsSkipped,
        recordsFailed,
      },
    });
    await db.device.update({
      where: { id: device.id },
      data: {
        lastSyncAt: new Date(),
        totalSynced: { increment: recordsInserted },
        status: "ONLINE",
        lastError: recordsRead === 0 ? "Sync OK — no new punches on device (or empty log buffer)." : null,
      },
    });
    return { recordsRead, recordsInserted, recordsSkipped, recordsFailed, status };
  } catch (error) {
    errorMessage = extractDeviceErrorMessage(error, publicErrorMessage(error));
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        recordsRead,
        recordsInserted,
        recordsSkipped,
        recordsFailed,
        errorMessage,
      },
    });
    await db.device.update({
      where: { id: device.id },
      data: { status: "OFFLINE", lastError: errorMessage },
    });
    throw new DeviceError(errorMessage, extractDeviceErrorMessage(error));
  }
  });
}
