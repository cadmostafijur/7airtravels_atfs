import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

/**
 * Wipe website punch data only (Neon DB). Does NOT clear the physical K50A.
 * After this, Sync now will re-import device logs and can send SMS again.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "attendance.write");

    const result = await prisma.$transaction(async (tx) => {
      const smsLogs = await tx.smsLog.deleteMany({});
      const punches = await tx.attendance.deleteMany({});
      const summaries = await tx.dailyAttendanceSummary.deleteMany({});
      return {
        smsLogs: smsLogs.count,
        punches: punches.count,
        summaries: summaries.count,
      };
    });

    await writeAudit({
      adminId: admin.id,
      action: "ATTENDANCE_CLEAR_WEBSITE",
      entity: "Attendance",
      ipAddress: clientIp(request),
      metadata: result,
    });

    return jsonOk({
      deleted: result,
      note: "Website cleared. K50A device logs are unchanged. Use Sync now to import again.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
