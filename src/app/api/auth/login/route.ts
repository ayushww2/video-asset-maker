import { NextRequest } from "next/server";
import { createSessionToken, sessionCookieHeader, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const user = verifyPassword(body.username || "", body.password || "");
  if (!user) return Response.json({ error: "Invalid username or password" }, { status: 401 });
  const token = await createSessionToken(user);
  return new Response(JSON.stringify({ ok: true, user }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookieHeader(token) },
  });
}
