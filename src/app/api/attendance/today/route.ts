import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { startOfZonedDay, endOfZonedDay } from "@/lib/time";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "attendance");
    const from = startOfZonedDay(new Date());
    const to = endOfZonedDay(new Date());
    const rows = await prisma.attendance.findMany({
      where: { timestamp: { gte: from, lte: to } },
      include: { employee: true, device: true },
      orderBy: { timestamp: "desc" },
    });
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}
