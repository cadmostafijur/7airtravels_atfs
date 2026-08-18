import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const schema = z.object({
  employeeCode: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  departmentId: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  deviceUserId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "employees");
    const { id } = await context.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        summaries: { orderBy: { workDate: "desc" }, take: 40 },
        attendances: { orderBy: { timestamp: "desc" }, take: 50 },
        leaves: { orderBy: { startDate: "desc" } },
      },
    });
    if (!employee) throw new AppError("Employee not found", 404);
    return jsonOk(employee);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "employees.write");
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    const employee = await prisma.employee.update({
      where: { id },
      data: { ...body, email: body.email || null },
    });
    await writeAudit({
      adminId: admin.id,
      action: "EMPLOYEE_UPDATE",
      entity: "Employee",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: body,
    });
    return jsonOk(employee);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "employees.write");
    const { id } = await context.params;
    await prisma.employee.update({ where: { id }, data: { status: "INACTIVE" } });
    await writeAudit({
      adminId: admin.id,
      action: "EMPLOYEE_DEACTIVATE",
      entity: "Employee",
      entityId: id,
      ipAddress: clientIp(request),
    });
    return jsonOk({ deactivated: true });
  } catch (error) {
    return jsonError(error);
  }
}
