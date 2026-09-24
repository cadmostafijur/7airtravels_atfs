import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { buildReport } from "@/lib/attendance/reports";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "reports");
    const { searchParams } = new URL(request.url);
    return jsonOk(
      await buildReport({
        type: searchParams.get("type") ?? "daily",
        from: searchParams.get("from") ?? new Date().toISOString(),
        to: searchParams.get("to") ?? new Date().toISOString(),
        employeeId: searchParams.get("employeeId") ?? undefined,
        departmentId: searchParams.get("departmentId") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        q: searchParams.get("q") ?? undefined,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
