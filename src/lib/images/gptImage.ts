import { createAndWaitForMedia, downloadMedia } from "@/lib/elevenlabs/flows";

export async function generateGptImage(prompt: string): Promise<Buffer> {
  const raw = (process.env.IMAGE_QUALITY || "low").toLowerCase();
  const quality = raw === "medium" || raw === "high" ? raw : "low";
  const result = await createAndWaitForMedia({
    kind: "image",
    body: {
      model_id: "gpt-image-2",
      prompt,
      quality,
      aspect_ratio: "16:9",
      resolution: "1K",
    },
    timeoutMs: 180_000,
  });
  return downloadMedia(result.url);
}
