import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "holidays");
    const { id } = await context.params;
    await prisma.holiday.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
