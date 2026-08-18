import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";

const schema = z.object({
  name: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10).optional(),
});

export async function GET(request: Request) {
  try {
    const admin = await requireApiSession(request, "dashboard");
    return jsonOk({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      timezone: process.env.APP_TIMEZONE ?? "Asia/Dhaka",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireApiSession(request, "dashboard");
    const body = schema.parse(await readJson(request));
    const data: { name?: string; passwordHash?: string } = {};
    if (body.name) data.name = body.name;
    if (body.newPassword) {
      const { verifyPassword } = await import("@/lib/auth/password");
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, admin.passwordHash))) {
        return jsonError(new Error("Current password is incorrect"), 400);
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }
    const updated = await prisma.admin.update({ where: { id: admin.id }, data });
    return jsonOk({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
  } catch (error) {
    return jsonError(error);
  }
}
