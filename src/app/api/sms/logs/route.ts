import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "sms");
    const logs = await prisma.smsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(logs);
  } catch (error) {
    return jsonError(error);
  }
}
