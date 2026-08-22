import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { notifyAttendanceSms } from "@/lib/sms/service";
import { processDailySummary } from "@/lib/attendance/process";

/**
 * Resend SMS for recent punches that have no SENT delivery log.
 * Sync skips duplicate punches, so old fingerprints never re-trigger SMS otherwise.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "sms");

    const punches = await prisma.attendance.findMany({
      where: { employeeId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        employee: true,
        smsLogs: { where: { status: "SENT" }, select: { id: true } },
      },
    });

    const pending = punches.filter((row) => row.smsLogs.length === 0);
    let attempted = 0;

    for (const punch of pending) {
      if (!punch.employee) continue;
      const summary = await processDailySummary(punch.employee.id, punch.timestamp);
      const refreshed = await prisma.attendance.findUnique({ where: { id: punch.id } });
      await notifyAttendanceSms(refreshed ?? punch, punch.employee, summary);
      attempted += 1;
    }

    const after = new Date(Date.now() - 120_000);
    const sent = await prisma.smsLog.count({
      where: {
        status: "SENT",
        attendanceId: { in: pending.map((p) => p.id) },
        OR: [{ sentAt: { gte: after } }, { createdAt: { gte: after } }],
      },
    });

    await writeAudit({
      adminId: admin.id,
      action: "SMS_RESEND_PUNCHES",
      entity: "SmsLog",
      ipAddress: clientIp(request),
      metadata: { punches: pending.length, attempted, sent },
    });

    return jsonOk({ punches: pending.length, attempted, sent });
  } catch (error) {
    return jsonError(error);
  }
}
