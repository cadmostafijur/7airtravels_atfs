import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const schema = z
  .object({
    name: z.string().min(2).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(10).optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.newPassword) {
      if (!body.currentPassword) {
        ctx.addIssue({
          code: "custom",
          message: "Current password is required to set a new password",
          path: ["currentPassword"],
        });
      }
      if (body.newPassword !== body.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          message: "New password and confirmation do not match",
          path: ["confirmPassword"],
        });
      }
    }
  });

export async function GET(request: Request) {
  try {
    const admin = await requireApiSession(request, "settings");
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
    const admin = await requireApiSession(request, "settings");
    const body = schema.parse(await readJson(request));
    const data: { name?: string; passwordHash?: string } = {};

    if (body.name) data.name = body.name;

    if (body.newPassword) {
      const valid = await verifyPassword(body.currentPassword!, admin.passwordHash);
      if (!valid) {
        throw new AppError("Current password is incorrect", 400, "INVALID_PASSWORD");
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }

    if (!data.name && !data.passwordHash) {
      throw new AppError("Nothing to update", 400);
    }

    const updated = await prisma.admin.update({ where: { id: admin.id }, data });

    if (data.passwordHash) {
      await writeAudit({
        adminId: admin.id,
        action: "PASSWORD_CHANGE",
        entity: "Admin",
        entityId: admin.id,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return jsonOk({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      passwordChanged: Boolean(data.passwordHash),
    });
  } catch (error) {
    return jsonError(error);
  }
}
