import { getSessionFromCookies } from "@/lib/session";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ user });
}
