import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "sms");
    const { id } = await context.params;
    const existing = await prisma.smsLog.findUnique({ where: { id } });
    if (!existing) throw new AppError("SMS log not found", 404);

    await prisma.smsLog.delete({ where: { id } });
    await writeAudit({
      adminId: admin.id,
      action: "SMS_LOG_DELETE",
      entity: "SmsLog",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: { recipient: existing.recipient, status: existing.status },
    });
    return jsonOk({ deleted: id });
  } catch (error) {
    return jsonError(error);
  }
}
