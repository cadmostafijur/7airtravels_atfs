import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { payrollHistory } from "@/lib/payroll";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "payroll");
    const month = new URL(request.url).searchParams.get("month") || undefined;
    return jsonOk(await payrollHistory(month));
  } catch (error) {
    return jsonError(error);
  }
}
