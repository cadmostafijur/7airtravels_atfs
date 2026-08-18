import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { encodeSession, sessionCookie } from "@/lib/auth/session";
import { jsonError, readJson, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`login:${ip}`, 8, 15 * 60 * 1000);
    if (!limited.ok) throw new AppError("Too many login attempts. Try again later.", 429);

    const body = schema.parse(await readJson(request));
    const admin = await prisma.admin.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!admin || admin.status !== "ACTIVE") {
      throw new AppError("Invalid email or password", 401);
    }
    const ok = await verifyPassword(body.password, admin.passwordHash);
    if (!ok) throw new AppError("Invalid email or password", 401);

    const token = await encodeSession({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({
      adminId: admin.id,
      action: "LOGIN",
      entity: "Admin",
      entityId: admin.id,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    const cookie = sessionCookie(token);
    const response = NextResponse.json({
      ok: true,
      data: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
