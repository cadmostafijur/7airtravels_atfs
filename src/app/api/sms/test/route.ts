import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { sendTestSms } from "@/lib/sms/service";

const schema = z.object({ phone: z.string().min(8) });

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "sms");
    const body = schema.parse(await readJson(request));
    return jsonOk(await sendTestSms(body.phone));
  } catch (error) {
    return jsonError(error);
  }
}
