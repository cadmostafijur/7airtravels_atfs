import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/errors";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { assertCan, type Permission } from "@/lib/auth/rbac";
import { assertSameOrigin } from "@/lib/http";

export async function getSessionAdmin() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await decodeSession(token);
  if (!payload) return null;
  const admin = await prisma.admin.findUnique({ where: { id: payload.sub } });
  if (!admin || admin.status !== "ACTIVE") return null;
  return admin;
}

export async function requireApiSession(request: Request, permission?: Permission) {
  assertSameOrigin(request);
  const admin = await getSessionAdmin();
  if (!admin) throw new AuthError();
  if (permission) assertCan(admin.role, permission);
  return admin;
}
