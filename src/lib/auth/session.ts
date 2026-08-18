import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@prisma/client";

const COOKIE = "atfs_session";

function secret() {
  const value = process.env.SESSION_SECRET ?? "dev-only-change-me-session-secret-32ch";
  return new TextEncoder().encode(value);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
};

export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function decodeSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name ?? ""),
      role: payload.role as AdminRole,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}

export const SESSION_COOKIE = COOKIE;
