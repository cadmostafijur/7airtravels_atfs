import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { workDateUtc } from "@/lib/time";

const schema = z.object({
  date: z.string(),
  name: z.string().min(2),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "holidays");
    return jsonOk(await prisma.holiday.findMany({ orderBy: { date: "asc" } }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "holidays");
    const body = schema.parse(await readJson(request));
    return jsonOk(
      await prisma.holiday.create({
        data: { name: body.name, date: workDateUtc(new Date(body.date)) },
      }),
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
