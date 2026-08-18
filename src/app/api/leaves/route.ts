import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { workDateUtc } from "@/lib/time";

const schema = z.object({
  employeeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "leaves");
    return jsonOk(
      await prisma.leave.findMany({
        include: { employee: true },
        orderBy: { startDate: "desc" },
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "leaves");
    const body = schema.parse(await readJson(request));
    const leave = await prisma.leave.create({
      data: {
        employeeId: body.employeeId,
        startDate: workDateUtc(new Date(body.startDate)),
        endDate: workDateUtc(new Date(body.endDate)),
        reason: body.reason,
        status: body.status ?? "PENDING",
      },
    });
    return jsonOk(leave, 201);
  } catch (error) {
    return jsonError(error);
  }
}
