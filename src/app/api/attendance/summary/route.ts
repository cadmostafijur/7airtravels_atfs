import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { workDateUtc } from "@/lib/time";

const createSchema = z.object({
  employeeId: z.string(),
  workDate: z.string(),
  status: z.enum([
    "PRESENT",
    "LATE",
    "ABSENT",
    "EARLY_LEAVE",
    "HALF_DAY",
    "LEAVE",
    "HOLIDAY",
    "WEEKEND",
    "OVERTIME",
  ]),
  checkInAt: z.string().nullable().optional(),
  checkOutAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lateMinutes: z.number().int().min(0).optional(),
  earlyMinutes: z.number().int().min(0).optional(),
  overtimeMinutes: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "attendance.write");
    const body = createSchema.parse(await readJson(request));
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!employee) throw new AppError("Employee not found", 404);

    const workDate = workDateUtc(new Date(body.workDate));
    const row = await prisma.dailyAttendanceSummary.create({
      data: {
        employeeId: body.employeeId,
        departmentId: employee.departmentId,
        workDate,
        status: body.status,
        checkInAt: body.checkInAt ? new Date(body.checkInAt) : null,
        checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : null,
        notes: body.notes ?? null,
        lateMinutes: body.lateMinutes ?? 0,
        earlyMinutes: body.earlyMinutes ?? 0,
        overtimeMinutes: body.overtimeMinutes ?? 0,
      },
      include: { employee: { include: { department: true } } },
    });

    await writeAudit({
      adminId: admin.id,
      action: "ATTENDANCE_CREATE",
      entity: "DailyAttendanceSummary",
      entityId: row.id,
      ipAddress: clientIp(request),
      metadata: { employeeId: body.employeeId, workDate: body.workDate, status: body.status },
    });

    return jsonOk(row, 201);
  } catch (error) {
    return jsonError(error);
  }
}
