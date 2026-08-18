import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const updateSchema = z.object({
  status: z
    .enum(["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "HALF_DAY", "LEAVE", "HOLIDAY", "WEEKEND", "OVERTIME"])
    .optional(),
  checkInAt: z.string().nullable().optional(),
  checkOutAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lateMinutes: z.number().int().min(0).optional(),
  earlyMinutes: z.number().int().min(0).optional(),
  overtimeMinutes: z.number().int().min(0).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "attendance.write");
    const { id } = await context.params;
    const body = updateSchema.parse(await readJson(request));

    const existing = await prisma.dailyAttendanceSummary.findUnique({ where: { id } });
    if (!existing) throw new AppError("Daily register entry not found", 404);

    const row = await prisma.dailyAttendanceSummary.update({
      where: { id },
      data: {
        status: body.status,
        checkInAt: body.checkInAt === undefined ? undefined : body.checkInAt ? new Date(body.checkInAt) : null,
        checkOutAt: body.checkOutAt === undefined ? undefined : body.checkOutAt ? new Date(body.checkOutAt) : null,
        notes: body.notes,
        lateMinutes: body.lateMinutes,
        earlyMinutes: body.earlyMinutes,
        overtimeMinutes: body.overtimeMinutes,
      },
      include: { employee: { include: { department: true } } },
    });

    await writeAudit({
      adminId: admin.id,
      action: "ATTENDANCE_UPDATE",
      entity: "DailyAttendanceSummary",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: body,
    });

    return jsonOk(row);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "attendance.write");
    const { id } = await context.params;

    const existing = await prisma.dailyAttendanceSummary.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!existing) throw new AppError("Daily register entry not found", 404);

    await prisma.dailyAttendanceSummary.delete({ where: { id } });

    await writeAudit({
      adminId: admin.id,
      action: "ATTENDANCE_DELETE",
      entity: "DailyAttendanceSummary",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: {
        employeeId: existing.employeeId,
        employeeName: existing.employee.name,
        workDate: existing.workDate,
      },
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
