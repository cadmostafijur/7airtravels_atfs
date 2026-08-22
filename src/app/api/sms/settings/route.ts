import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { detectOutboundPublicIp } from "@/lib/sms/provider";
import { env } from "@/lib/env";

const schema = z.object({
  enabled: z.boolean(),
  adminPhone1: z.string().optional().nullable(),
  adminPhone2: z.string().optional().nullable(),
  adminPhone3: z.string().optional().nullable(),
  notifyOnAttendance: z.boolean(),
  notifyOnLate: z.boolean(),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "sms");
    const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
    const latestFailed = await prisma.smsLog.findFirst({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { providerResponse: true, createdAt: true },
    });
    const outboundIp = await detectOutboundPublicIp();
    const blockedIp = latestFailed?.providerResponse?.match(/ip\s+([0-9.]+)/i)?.[1] ?? null;

    return jsonOk({
      ...settings,
      gateway: {
        provider: env.sms.provider,
        configured: Boolean(env.sms.apiUrl && env.sms.apiKey),
        senderId: env.sms.senderId,
        method: env.sms.method,
        outboundIp,
        lastBlockedIp: blockedIp,
        lastFailedResponse: latestFailed?.providerResponse?.slice(0, 400) ?? null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireApiSession(request, "sms");
    const body = schema.parse(await readJson(request));
    const settings = await prisma.smsSetting.upsert({
      where: { id: "default" },
      create: { id: "default", ...body },
      update: body,
    });
    await writeAudit({
      adminId: admin.id,
      action: "SMS_SETTINGS_UPDATE",
      entity: "SmsSetting",
      entityId: "default",
      ipAddress: clientIp(request),
    });
    return jsonOk(settings);
  } catch (error) {
    return jsonError(error);
  }
}
