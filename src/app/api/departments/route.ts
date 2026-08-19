import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

const schema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "employees");
    return jsonOk(await prisma.department.findMany({ orderBy: { name: "asc" } }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "employees.write");
    const body = schema.parse(await readJson(request));
    return jsonOk(
      await prisma.department.create({
        data: { name: body.name, code: body.code.toUpperCase() },
      }),
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
