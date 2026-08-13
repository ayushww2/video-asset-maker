import { NextRequest } from "next/server";
import { generateGptImage } from "@/lib/images/openaiImage";
import { getSessionFromCookies } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { prompt?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = (body.prompt || "").trim();
  if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

  try {
    const image = await generateGptImage({ prompt });
    return Response.json({
      ok: true,
      mimeType: image.contentType,
      imageBase64: image.bytes.toString("base64"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
