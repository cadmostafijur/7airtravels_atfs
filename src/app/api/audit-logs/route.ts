import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "audit");
    const logs = await prisma.auditLog.findMany({
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk(logs);
  } catch (error) {
    return jsonError(error);
  }
}
