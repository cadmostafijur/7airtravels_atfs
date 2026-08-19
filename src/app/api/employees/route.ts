import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  employeeCode: z.string().min(2),
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional(),
  deviceUserId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  joinedAt: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "employees");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = searchParams.get("status") || undefined;
    const employees = await prisma.employee.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { employeeCode: { contains: q, mode: "insensitive" } },
                { deviceUserId: { contains: q } },
              ],
            }
          : {}),
      },
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    });
    return jsonOk(employees);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "employees.write");
    const body = schema.parse(await readJson(request));
    const employee = await prisma.employee.create({
      data: {
        ...body,
        email: body.email || null,
        joinedAt: body.joinedAt ? new Date(body.joinedAt) : undefined,
      },
    });
    await writeAudit({
      adminId: admin.id,
      action: "EMPLOYEE_CREATE",
      entity: "Employee",
      entityId: employee.id,
      ipAddress: clientIp(request),
    });
    return jsonOk(employee, 201);
  } catch (error) {
    return jsonError(error);
  }
}
