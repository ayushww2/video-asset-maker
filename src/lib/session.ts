import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}
