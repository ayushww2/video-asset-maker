import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/env";

export const PUBLIC_ACTOR: SessionUser = { username: "studio", displayName: "Studio" };

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Logged-in user, or a public actor when auth is disabled. */
export async function getSessionOrPublic(): Promise<SessionUser | null> {
  const user = await getSessionFromCookies();
  if (user) return user;
  if (!isAuthEnabled()) return PUBLIC_ACTOR;
  return null;
}
