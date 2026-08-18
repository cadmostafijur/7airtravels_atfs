import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

const schema = z.object({
  name: z.string().min(2),
  officeStart: z.string(),
  lateThreshold: z.string(),
  officeEnd: z.string(),
  halfDayAfter: z.string().optional(),
  overtimeAfter: z.string().optional(),
  weekendDays: z.array(z.number().int().min(0).max(6)).optional(),
  isDefault: z.boolean().optional(),
  timezone: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "shifts");
    return jsonOk(await prisma.shift.findMany({ orderBy: { createdAt: "asc" } }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "shifts");
    const body = schema.parse(await readJson(request));
    if (body.isDefault) {
      await prisma.shift.updateMany({ data: { isDefault: false } });
    }
    return jsonOk(await prisma.shift.create({ data: body }), 201);
  } catch (error) {
    return jsonError(error);
  }
}
