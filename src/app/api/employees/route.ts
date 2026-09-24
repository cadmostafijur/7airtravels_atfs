import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { linkOrphanAttendances } from "@/lib/attendance/link-orphans";

const schema = z.object({
  employeeCode: z.string().min(2),
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  deviceUserId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  joinedAt: z.union([z.string(), z.literal(""), z.null()]).optional(),
  nidNumber: z.union([z.string(), z.literal(""), z.null()]).optional(),
  nidDocumentUrl: z.union([z.string(), z.literal(""), z.null()]).optional(),
  monthlySalary: z.coerce.number().int().min(0).max(20_000_000).optional(),
  latePenalty: z.union([z.coerce.number().int().min(0).max(20_000_000), z.null(), z.literal("")]).optional(),
  absentPenalty: z.union([z.coerce.number().int().min(0).max(20_000_000), z.null(), z.literal("")]).optional(),
});

function penaltyValue(value: number | "" | null | undefined) {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return null;
  return value;
}

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
                { nidNumber: { contains: q, mode: "insensitive" } },
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
        employeeCode: body.employeeCode,
        name: body.name,
        phone: body.phone || null,
        email: body.email || null,
        departmentId: body.departmentId || null,
        designation: body.designation || null,
        deviceUserId: body.deviceUserId,
        status: body.status,
        joinedAt: body.joinedAt ? new Date(body.joinedAt) : null,
        nidNumber: body.nidNumber?.trim() || null,
        nidDocumentUrl: body.nidDocumentUrl?.trim() || null,
        monthlySalary: body.monthlySalary ?? 0,
        latePenalty: penaltyValue(body.latePenalty) ?? null,
        absentPenalty: penaltyValue(body.absentPenalty) ?? null,
      },
    });
    await writeAudit({
      adminId: admin.id,
      action: "EMPLOYEE_CREATE",
      entity: "Employee",
      entityId: employee.id,
      ipAddress: clientIp(request),
    });
    await linkOrphanAttendances(employee.id, employee.deviceUserId);
    return jsonOk(employee, 201);
  } catch (error) {
    return jsonError(error);
  }
}
