import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { getDashboardStats, getTrendData } from "@/lib/attendance/stats";
import { markAbsentsForDate } from "@/lib/attendance/process";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "dashboard");
    await markAbsentsForDate(new Date()).catch(() => undefined);
    const [stats, trend] = await Promise.all([getDashboardStats(), getTrendData()]);
    return jsonOk({ ...stats, trend });
  } catch (error) {
    return jsonError(error);
  }
}
