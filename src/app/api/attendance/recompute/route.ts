import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { recomputeSummaries } from "@/lib/attendance/process";
import { startOfZonedDay, endOfZonedDay } from "@/lib/time";

const bodySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "attendance.write");
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);
    const from = startOfZonedDay(new Date(body.from || Date.now()));
    const to = endOfZonedDay(new Date(body.to || body.from || Date.now()));
    const result = await recomputeSummaries(from, to);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
