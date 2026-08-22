import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { startOfZonedDay, endOfZonedDay } from "@/lib/time";
import { summaryWhere } from "@/lib/attendance/stats";
import { loadPunchBundlesForSummaries, summaryPunchKey } from "@/lib/attendance/punches";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "attendance");
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = searchParams.get("status") || undefined;
    const q = searchParams.get("q") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? startOfZonedDay(new Date(from)) : startOfZonedDay(new Date());
    const toDate = to ? endOfZonedDay(new Date(to)) : endOfZonedDay(new Date());

    const summaries = await prisma.dailyAttendanceSummary.findMany({
      where: summaryWhere({
        from: fromDate,
        to: toDate,
        employeeId,
        departmentId,
        status: status as never,
        q,
      }),
      include: { employee: { include: { department: true } } },
      orderBy: [{ workDate: "desc" }, { employee: { name: "asc" } }],
    });

    const punchMap = await loadPunchBundlesForSummaries(summaries);
    const rows = summaries.map((row) => {
      const punches = punchMap.get(summaryPunchKey(row.employeeId, row.workDate)) ?? {
        punchCount: 0,
        pairs: [],
        pairsLabel: "—",
        inTimes: [],
        outTimes: [],
      };
      return { ...row, punches };
    });

    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}
