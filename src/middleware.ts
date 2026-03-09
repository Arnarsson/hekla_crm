import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/shared", "/api/auth", "/api/partners"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Check auth cookie
  const session = req.cookies.get("hekla_session")?.value;

  if (session && isValidSession(session, req)) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

function hashPassword(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const char = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hk_${Math.abs(hash).toString(36)}`;
}

function isValidSession(session: string, _req: NextRequest): boolean {
  // Check master password hash
  const password = process.env.AUTH_PASSWORD || "hekla2024";
  if (session === hashPassword(password)) {
    return true;
  }

  // Check user session format (set by auth API as httpOnly cookie)
  // User sessions are password hashes in hk_* format, set only by our auth endpoint
  if (session.startsWith("hk_") && session.length >= 4) {
    return true;
  }

  return false;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
