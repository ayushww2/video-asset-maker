import { NextRequest } from "next/server";
import { estimateJob } from "@/lib/estimate";
import { getSessionFromCookies } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { assetCount?: number; referenceCount?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return Response.json({
    estimate: estimateJob({
      assetCount: Number(body.assetCount || 22),
      referenceCount: Number(body.referenceCount || 0),
    }),
  });
}
