import { NextRequest } from "next/server";
import { getFromR2 } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: parts } = await context.params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
  const file = await getFromR2(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
