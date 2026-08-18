import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "employees");
    return jsonOk(await prisma.department.findMany({ orderBy: { name: "asc" } }));
  } catch (error) {
    return jsonError(error);
  }
}
