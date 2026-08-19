import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "vam_session";

export type SessionUser = { username: string; displayName: string };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function verifyPassword(username: string, password: string): SessionUser | null {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) return null;
  const expected = process.env[`AUTH_${normalized.toUpperCase()}_PASSWORD`];
  if (!expected || expected !== password) return null;
  return {
    username: normalized,
    displayName: normalized.charAt(0).toUpperCase() + normalized.slice(1),
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username, displayName: user.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const username = String(payload.username || "");
    if (!username) return null;
    return { username, displayName: String(payload.displayName || username) };
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
