import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { simulateScenario } from "@/lib/attendance/simulation";

const schema = z.object({
  scenario: z.enum(["check-in", "check-out", "late", "duplicate", "offline-sync", "sms-failure"]),
  employeeId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "simulation");
    const body = schema.parse(await readJson(request));
    return jsonOk(await simulateScenario(body));
  } catch (error) {
    return jsonError(error);
  }
}
