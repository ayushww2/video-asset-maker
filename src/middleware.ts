import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/jobs/", "/api/health", "/api/media/", "/api/auth/login"];
const PUBLIC_JOB_API = /^\/api\/jobs\/[0-9a-fA-F-]{36}$/;

function isPublic(pathname: string, method: string) {
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  if (method === "GET" && PUBLIC_JOB_API.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname, req.method)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await readSessionToken(token);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
