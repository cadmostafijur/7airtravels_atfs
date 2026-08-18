import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

const schema = z.object({
  officeStart: z.string().optional(),
  lateThreshold: z.string().optional(),
  officeEnd: z.string().optional(),
  halfDayAfter: z.string().optional(),
  overtimeAfter: z.string().optional(),
  weekendDays: z.array(z.number()).optional(),
  isDefault: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "shifts");
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    if (body.isDefault) await prisma.shift.updateMany({ data: { isDefault: false } });
    return jsonOk(await prisma.shift.update({ where: { id }, data: body }));
  } catch (error) {
    return jsonError(error);
  }
}
