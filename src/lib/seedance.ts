import { fal } from "@fal-ai/client";

const MODEL = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";

export const I2V_SUFFIX =
  "Use the uploaded image as the exact reference frame. Preserve the same composition, objects, lighting, and documentary style. Do not redesign the scene. Animate only subtle believable movement. Keep the motion practical, restrained, and realistic, as if this is real recovered footage.";

export function withI2vSuffix(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes("Use the uploaded image as the exact reference frame")) return trimmed;
  return `${trimmed}\n\n${I2V_SUFFIX}`;
}

export function seedanceRequestBody(input: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string | null;
}) {
  const body: {
    prompt: string;
    image_url: string;
    end_image_url?: string;
    aspect_ratio: "16:9";
    resolution: "480p";
    duration: "6";
    generate_audio: false;
    camera_fixed: false;
  } = {
    prompt: withI2vSuffix(input.prompt),
    image_url: input.startImageUrl,
    aspect_ratio: "16:9",
    resolution: "480p",
    duration: "6",
    generate_audio: false,
    camera_fixed: false,
  };
  if (input.endImageUrl) body.end_image_url = input.endImageUrl;
  return body;
}

export async function generateSeedanceClip(input: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string | null;
}): Promise<Buffer> {
  const key = process.env.FAL_KEY || "";
  if (!key) throw new Error("FAL_KEY is not set (needed for Seedance 1.5 Pro)");
  fal.config({ credentials: key });

  const result = await fal.subscribe(MODEL, {
    input: seedanceRequestBody(input),
    logs: false,
  });

  const url = (result.data as { video?: { url?: string } } | undefined)?.video?.url;
  if (!url) throw new Error("Seedance 1.5 Pro returned no video URL");
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Failed to download Seedance clip (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
