import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

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
    return jsonOk(settings);
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
