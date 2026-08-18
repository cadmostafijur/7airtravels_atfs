import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { startOfZonedDay, endOfZonedDay, workDateUtc } from "@/lib/time";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "reports");
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "daily";
    const from = startOfZonedDay(new Date(searchParams.get("from") ?? Date.now()));
    const to = endOfZonedDay(new Date(searchParams.get("to") ?? Date.now()));
    const employeeId = searchParams.get("employeeId") ?? undefined;
    const departmentId = searchParams.get("departmentId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    if (type === "raw") {
      const rows = await prisma.attendance.findMany({
        where: {
          timestamp: { gte: from, lte: to },
          employeeId,
        },
        include: { employee: true, device: true },
        orderBy: { timestamp: "asc" },
      });
      return jsonOk(rows);
    }

    const where = {
      workDate: { gte: workDateUtc(from), lte: workDateUtc(to) },
      employeeId,
      departmentId,
      status: status as never,
    };

    const rows = await prisma.dailyAttendanceSummary.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: [{ workDate: "asc" }, { employee: { name: "asc" } }],
    });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}
