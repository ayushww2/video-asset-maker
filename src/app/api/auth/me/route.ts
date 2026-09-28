import { getSessionOrPublic } from "@/lib/session";
import { isAuthEnabled } from "@/lib/env";

export async function GET() {
  const user = await getSessionOrPublic();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ user, authRequired: isAuthEnabled() });
}
