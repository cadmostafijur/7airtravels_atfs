import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { getSessionAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/http";

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (admin) {
    await writeAudit({
      adminId: admin.id,
      action: "LOGOUT",
      entity: "Admin",
      entityId: admin.id,
      ipAddress: clientIp(request),
    });
  }
  const cookie = clearSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
