import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

const schema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "leaves");
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    return jsonOk(await prisma.leave.update({ where: { id }, data: body }));
  } catch (error) {
    return jsonError(error);
  }
}
