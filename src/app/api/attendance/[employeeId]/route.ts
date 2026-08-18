import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { startOfZonedDay, endOfZonedDay } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "attendance");
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const from = startOfZonedDay(new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000));
    const to = endOfZonedDay(new Date(searchParams.get("to") ?? Date.now()));
    const rows = await prisma.attendance.findMany({
      where: { employeeId: id, timestamp: { gte: from, lte: to } },
      include: { device: true },
      orderBy: { timestamp: "desc" },
    });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}
