import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

/** Website-stored punches for this device (not live K50A read). */
export async function GET(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "devices");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new AppError("Device not found", 404);

    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("take") ?? 100) || 100, 500);

    const rows = await prisma.attendance.findMany({
      where: { deviceId: id },
      include: { employee: { select: { name: true, employeeCode: true } } },
      orderBy: { timestamp: "desc" },
      take,
    });

    return jsonOk({
      count: rows.length,
      totalOnWebsite: await prisma.attendance.count({ where: { deviceId: id } }),
      punches: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        when: formatDateTime(row.timestamp),
        deviceUserId: row.deviceUserId,
        type: row.attendanceType,
        employee: row.employee?.name ?? null,
        employeeCode: row.employee?.employeeCode ?? null,
        mapped: Boolean(row.employeeId),
        source: row.source,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
