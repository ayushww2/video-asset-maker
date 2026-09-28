import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/env";

export const PUBLIC_ACTOR: SessionUser = { username: "studio", displayName: "Studio" };

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function getSessionOrPublic(): Promise<SessionUser | null> {
  const user = await getSessionFromCookies();
  if (user) return user;
  if (!isAuthEnabled()) return PUBLIC_ACTOR;
  return null;
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
