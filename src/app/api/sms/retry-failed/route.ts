import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { createSmsProvider } from "@/lib/sms/provider";
import { writeAudit } from "@/lib/audit";

/** Resend all FAILED SMS logs (same message text). */
export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "sms");
    const failed = await prisma.smsLog.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const provider = createSmsProvider();
    let sent = 0;
    let stillFailed = 0;

    for (const log of failed) {
      const result = await provider.sendSms(log.recipient, log.message);
      await prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.response,
          sentAt: result.success ? new Date() : log.sentAt,
          retryCount: { increment: 1 },
        },
      });
      if (result.success) sent += 1;
      else stillFailed += 1;
    }

    await writeAudit({
      adminId: admin.id,
      action: "SMS_RETRY_FAILED",
      entity: "SmsLog",
      ipAddress: clientIp(request),
      metadata: { attempted: failed.length, sent, stillFailed },
    });

    return jsonOk({ attempted: failed.length, sent, stillFailed });
  } catch (error) {
    return jsonError(error);
  }
}
