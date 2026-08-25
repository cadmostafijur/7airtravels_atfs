import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";

const schema = z.object({
  name: z.string().min(2),
  code: z.string().max(12).optional(),
});

function codeFromName(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return cleaned.length >= 2 ? cleaned : `DEP${Date.now().toString().slice(-4)}`;
}

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
    const code = (body.code?.trim() || codeFromName(body.name)).toUpperCase();
    return jsonOk(
      await prisma.department.create({
        data: { name: body.name.trim(), code },
      }),
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
