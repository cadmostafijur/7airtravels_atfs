import "server-only";

import { prisma } from "@/lib/prisma";
import { createSmsProvider } from "@/lib/sms/provider";
import { normalizeBdPhone } from "@/lib/sms/phone";
import { env } from "@/lib/env";
import { formatDate, formatTime, workDateKey } from "@/lib/time";
import { logger } from "@/lib/logger";
import type { Attendance, DailyAttendanceSummary, Employee } from "@prisma/client";

function phonesFrom(settings: {
  adminPhone1: string | null;
  adminPhone2: string | null;
  adminPhone3: string | null;
  adminPhones?: unknown;
}): string[] {
  const extras = Array.isArray(settings.adminPhones)
    ? settings.adminPhones.map((value) => (typeof value === "string" ? value : "")).filter(Boolean)
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [settings.adminPhone1, settings.adminPhone2, settings.adminPhone3, ...extras]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const normalized = normalizeBdPhone(trimmed);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PRESENT: "Present",
    LATE: "Late",
    ABSENT: "Absent",
    EARLY_LEAVE: "Early leave",
    HALF_DAY: "Half day",
    LEAVE: "On leave",
    HOLIDAY: "Holiday",
    WEEKEND: "Weekend",
    OVERTIME: "Overtime",
  };
  return map[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function buildMessage(
  employee: Employee,
  attendance: Attendance,
  summary: DailyAttendanceSummary | null,
): { eventType: string; message: string } {
  const status = summary?.status ?? "PRESENT";
  const time = formatTime(attendance.timestamp);
  const date = formatDate(attendance.timestamp);
  const name = employee.name.trim();
  const code = employee.employeeCode?.trim() || "—";
  const isOut = attendance.attendanceType === "CHECK_OUT";
  const eventType = isOut ? "CHECK_OUT" : status === "LATE" ? "LATE_CHECKIN" : "ATTENDANCE";

  const action =
    isOut ? "Check-out" : status === "LATE" ? "Late check-in" : "Check-in";

  const message = `7AIR ATFS | ${name} (${code}) | ${action}: ${time}, ${date} | Status: ${statusLabel(status)}`;

  return { eventType, message };
}

export async function notifyAttendanceSms(
  attendance: Attendance,
  employee: Employee | null,
  summary: DailyAttendanceSummary | null,
) {
  if (!employee) {
    logger.warn("sms_skipped_no_employee", {
      attendanceId: attendance.id,
      deviceUserId: attendance.deviceUserId,
    });
    return;
  }
  try {
    const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
    if (!settings?.enabled) {
      logger.warn("sms_skipped_disabled", { attendanceId: attendance.id });
      return;
    }
    if (!settings.notifyOnAttendance) {
      logger.warn("sms_skipped_notifyOnAttendance_false", { attendanceId: attendance.id });
      return;
    }
    // Late status still sends when notifyOnAttendance is on.
    // notifyOnLate is reserved for future late-only digests; do not block punch alerts.

    const recipients = phonesFrom(settings);
    if (recipients.length === 0) {
      logger.warn("sms_skipped_no_recipients", { attendanceId: attendance.id });
      return;
    }

    // Skip multi-day history floods, but always allow same Dhaka calendar-day punches
    // (worker downtime often syncs morning punches >60 minutes later).
    const ageMinutes = (Date.now() - attendance.timestamp.getTime()) / 60_000;
    const sameWorkDay = workDateKey(attendance.timestamp) === workDateKey(new Date());
    if (!sameWorkDay && ageMinutes > env.sms.maxPunchAgeMinutes) {
      logger.info("sms_skipped_punch_too_old", {
        attendanceId: attendance.id,
        ageMinutes: Math.round(ageMinutes),
        maxPunchAgeMinutes: env.sms.maxPunchAgeMinutes,
      });
      return;
    }

    const { eventType, message } = buildMessage(employee, attendance, summary);
    const provider = createSmsProvider();
    logger.info("sms_attendance_notify_start", {
      employee: employee.name,
      attendanceId: attendance.id,
      recipients: recipients.length,
      eventType,
      provider: provider.name,
    });

    await Promise.all(
      recipients.map(async (recipient) => {
        const notificationKey = `${attendance.id}:${eventType}:${recipient}`;
        const existing = await prisma.smsLog.findUnique({ where: { notificationKey } });
        if (existing?.status === "SENT" && existing.providerResponse !== "logged-to-console") return;
        if (existing?.status === "FAILED" && !env.sms.retryFailed) return;

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
      }),
    );
  } catch (error) {
    logger.error("sms_pipeline_failed", {
      attendanceId: attendance.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendTestSms(phone: string) {
  const provider = createSmsProvider();
  const recipient = normalizeBdPhone(phone);
  const message = "7AIR ATFS | Test SMS OK | Gateway is working.";
  const result = await provider.sendSms(recipient, message);
  await prisma.smsLog.create({
    data: {
      notificationKey: `test:${recipient}:${Date.now()}`,
      recipient,
      message,
      eventType: "TEST",
      status: result.success ? "SENT" : "FAILED",
      providerResponse: result.response,
      sentAt: result.success ? new Date() : null,
    },
  });
  return result;
}
