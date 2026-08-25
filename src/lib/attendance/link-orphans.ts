import "server-only";

import { prisma } from "@/lib/prisma";
import { processDailySummary } from "@/lib/attendance/process";
import { notifyAttendanceSms } from "@/lib/sms/service";
import { workDateKey } from "@/lib/time";
import { logger } from "@/lib/logger";

/**
 * Link punches that arrived before the employee was mapped to this K50A user ID,
 * then rebuild daily register rows (and SMS for same-day punches).
 */
export async function linkOrphanAttendances(employeeId: string, deviceUserId: string) {
  const uid = String(deviceUserId);
  const orphans = await prisma.attendance.findMany({
    where: { deviceUserId: uid, employeeId: null },
    orderBy: { timestamp: "asc" },
  });
  if (!orphans.length) return { linked: 0, days: 0, smsAttempted: 0 };

  await prisma.attendance.updateMany({
    where: { deviceUserId: uid, employeeId: null },
    data: { employeeId },
  });

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { linked: orphans.length, days: 0, smsAttempted: 0 };

  const byDay = new Map<string, Date>();
  for (const row of orphans) {
    byDay.set(workDateKey(row.timestamp), row.timestamp);
  }

  for (const at of byDay.values()) {
    await processDailySummary(employeeId, at);
  }

  const today = workDateKey(new Date());
  const todayOrphans = orphans.filter((row) => workDateKey(row.timestamp) === today);
  let smsAttempted = 0;
  for (const punch of todayOrphans) {
    const refreshed = await prisma.attendance.findUnique({ where: { id: punch.id } });
    if (!refreshed) continue;
    const summary = await processDailySummary(employeeId, refreshed.timestamp);
    try {
      await notifyAttendanceSms(refreshed, employee, summary);
      smsAttempted += 1;
    } catch (error) {
      logger.error("sms_after_orphan_link_failed", { error: String(error), attendanceId: punch.id });
    }
  }

  logger.info("orphan_attendances_linked", {
    employeeId,
    deviceUserId: uid,
    linked: orphans.length,
    days: byDay.size,
    smsAttempted,
  });

  return { linked: orphans.length, days: byDay.size, smsAttempted };
}
