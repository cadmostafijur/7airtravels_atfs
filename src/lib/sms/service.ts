import "server-only";

import { prisma } from "@/lib/prisma";
import { createSmsProvider } from "@/lib/sms/provider";
import { env } from "@/lib/env";
import { formatDate, formatTime } from "@/lib/time";
import { logger } from "@/lib/logger";
import type { Attendance, DailyAttendanceSummary, Employee } from "@prisma/client";

function phonesFrom(settings: {
  adminPhone1: string | null;
  adminPhone2: string | null;
  adminPhone3: string | null;
}): string[] {
  return [settings.adminPhone1, settings.adminPhone2, settings.adminPhone3]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function buildMessage(
  employee: Employee,
  attendance: Attendance,
  summary: DailyAttendanceSummary | null,
): { eventType: string; message: string } {
  const status = summary?.status ?? "PRESENT";
  const eventType = status === "LATE" ? "LATE_CHECKIN" : "ATTENDANCE";
  const when = `${formatTime(attendance.timestamp)} on ${formatDate(attendance.timestamp)}`;
  if (status === "LATE") {
    return {
      eventType,
      message: `Attendance Alert: ${employee.name} checked in at ${formatTime(attendance.timestamp)}. Status: Late. Shift start: configured office start.`,
    };
  }
  return {
    eventType,
    message: `Attendance Alert: ${employee.name} checked in at ${when}. Status: ${status === "PRESENT" ? "Present" : status.replaceAll("_", " ").toLowerCase()}.`,
  };
}

export async function notifyAttendanceSms(
  attendance: Attendance,
  employee: Employee | null,
  summary: DailyAttendanceSummary | null,
) {
  if (!employee) return;
  try {
    const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
    if (!settings?.enabled) return;
    if (!settings.notifyOnAttendance) return;
    if (summary?.status === "LATE" && !settings.notifyOnLate) return;

    const recipients = phonesFrom(settings);
    if (recipients.length === 0) return;

    const { eventType, message } = buildMessage(employee, attendance, summary);
    const provider = createSmsProvider();

    for (const recipient of recipients) {
      const notificationKey = `${attendance.id}:${eventType}:${recipient}`;
      const existing = await prisma.smsLog.findUnique({ where: { notificationKey } });
      if (existing?.status === "SENT") continue;
      if (existing?.status === "FAILED" && !env.sms.retryFailed) continue;

      try {
        const result = await provider.sendSms(recipient, message);
        await prisma.smsLog.upsert({
          where: { notificationKey },
          create: {
            notificationKey,
            recipient,
            message,
            eventType,
            status: result.success ? "SENT" : "FAILED",
            providerResponse: result.response,
            attendanceId: attendance.id,
            sentAt: result.success ? new Date() : null,
            retryCount: existing ? existing.retryCount + 1 : 0,
          },
          update: {
            status: result.success ? "SENT" : "FAILED",
            providerResponse: result.response,
            sentAt: result.success ? new Date() : existing?.sentAt,
            retryCount: { increment: 1 },
          },
        });
      } catch (error) {
        logger.error("sms_send_failed", {
          recipient,
          attendanceId: attendance.id,
          error: error instanceof Error ? error.message : String(error),
        });
        await prisma.smsLog.upsert({
          where: { notificationKey },
          create: {
            notificationKey,
            recipient,
            message,
            eventType,
            status: "FAILED",
            providerResponse: error instanceof Error ? error.message : "unknown",
            attendanceId: attendance.id,
          },
          update: {
            status: "FAILED",
            providerResponse: error instanceof Error ? error.message : "unknown",
            retryCount: { increment: 1 },
          },
        });
      }
    }
  } catch (error) {
    logger.error("sms_pipeline_failed", {
      attendanceId: attendance.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendTestSms(phone: string) {
  const provider = createSmsProvider();
  const message = "7 Air Travels ATFS test message. SMS gateway is reachable.";
  const result = await provider.sendSms(phone, message);
  await prisma.smsLog.create({
    data: {
      notificationKey: `test:${phone}:${Date.now()}`,
      recipient: phone,
      message,
      eventType: "TEST",
      status: result.success ? "SENT" : "FAILED",
      providerResponse: result.response,
      sentAt: result.success ? new Date() : null,
    },
  });
  return result;
}
