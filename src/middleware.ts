import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";

const publicPaths = ["/login", "/api/auth/login", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    publicPaths.some((path) => pathname === path || pathname.startsWith("/_next") || pathname.startsWith("/brand"))
  ) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await decodeSession(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/login"],
};
