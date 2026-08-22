import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(2).optional(),
  model: z.string().optional(),
  adapterType: z.enum(["k50a", "mock"]).optional(),
  ipAddress: z.string().min(7).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  location: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  commKey: z.number().int().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "devices");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        syncLogs: { orderBy: { startedAt: "desc" }, take: 10 },
        commLogs: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!device) throw new AppError("Device not found", 404);
    return jsonOk(device);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "devices");
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    const device = await prisma.device.update({ where: { id }, data: body });
    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_UPDATE",
      entity: "Device",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: body,
    });
    return jsonOk(device);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "devices");
    const { id } = await context.params;
    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) throw new AppError("Device not found", 404);

    await prisma.$transaction(async (tx) => {
      const attendanceIds = (
        await tx.attendance.findMany({ where: { deviceId: id }, select: { id: true } })
      ).map((row) => row.id);

      if (attendanceIds.length) {
        await tx.smsLog.deleteMany({ where: { attendanceId: { in: attendanceIds } } });
        await tx.attendance.deleteMany({ where: { id: { in: attendanceIds } } });
      }

      await tx.syncLog.deleteMany({ where: { deviceId: id } });
      await tx.deviceCommLog.deleteMany({ where: { deviceId: id } });
      await tx.device.delete({ where: { id } });
    });

    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_DELETE",
      entity: "Device",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: { name: existing.name, ipAddress: existing.ipAddress },
    });
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
