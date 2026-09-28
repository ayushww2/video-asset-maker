import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "vam_session";

export type SessionUser = {
  username: string;
  displayName: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function listUsers(): SessionUser[] {
  const users: SessionUser[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^AUTH_([A-Z0-9]+)_PASSWORD$/);
    if (!match || !value) continue;
    const username = match[1].toLowerCase();
    users.push({
      username,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
    });
  }
  return users;
}

export function verifyPassword(username: string, password: string): SessionUser | null {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) return null;
  const envKey = `AUTH_${normalized.toUpperCase()}_PASSWORD`;
  const expected = process.env[envKey];
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
    const displayName = String(payload.displayName || username);
    if (!username) return null;
    return { username, displayName };
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
