import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "sms");
    const logs = await prisma.smsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(logs);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireApiSession(request, "sms");
    const result = await prisma.smsLog.deleteMany({});
    await writeAudit({
      adminId: admin.id,
      action: "SMS_LOG_CLEAR",
      entity: "SmsLog",
      ipAddress: clientIp(request),
      metadata: { deletedCount: result.count },
    });
    return jsonOk({ deletedCount: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
