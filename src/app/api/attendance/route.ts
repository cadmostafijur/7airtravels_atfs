import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { startOfZonedDay, endOfZonedDay } from "@/lib/time";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "attendance");
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = searchParams.get("status") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? startOfZonedDay(new Date(from)) : startOfZonedDay(new Date());
    const toDate = to ? endOfZonedDay(new Date(to)) : endOfZonedDay(new Date());

    const summaries = await prisma.dailyAttendanceSummary.findMany({
      where: {
        workDate: { gte: fromDate, lte: toDate },
        ...(employeeId ? { employeeId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { employee: { include: { department: true } } },
      orderBy: [{ workDate: "desc" }, { employee: { name: "asc" } }],
    });
    return jsonOk(summaries);
  } catch (error) {
    return jsonError(error);
  }
}
