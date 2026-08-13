import { createAndWaitForMedia, downloadMedia } from "@/lib/elevenlabs/flows";
import { CLIP_SECONDS } from "@/lib/jobs/pipeline";

export const SEEDANCE_MODEL_ID = "bytedance-seedance-v2-mini";
export const SEEDANCE_RESOLUTION = "480p" as const;

export const I2V_SUFFIX =
  "Use the uploaded image as the exact reference frame. Preserve the same composition, objects, lighting, and documentary style. Do not redesign the scene. Animate only subtle believable movement. Keep the motion practical, restrained, and realistic, as if this is real recovered footage.";

export function withI2vSuffix(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes("Use the uploaded image as the exact reference frame")) return trimmed;
  return `${trimmed}\n\n${I2V_SUFFIX}`;
}

type InlineFrame = {
  type: "inline_base64";
  content_base64: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
};

export function seedanceRequestBody(input: {
  prompt: string;
  startFrame: InlineFrame;
  endFrame?: InlineFrame | null;
}) {
  const body: {
    model_id: typeof SEEDANCE_MODEL_ID;
    prompt: string;
    aspect_ratio: "16:9";
    resolution: typeof SEEDANCE_RESOLUTION;
    duration_secs: number;
    generate_audio: false;
    start_frame: InlineFrame;
    end_frame?: InlineFrame;
  } = {
    model_id: SEEDANCE_MODEL_ID,
    prompt: withI2vSuffix(input.prompt),
    aspect_ratio: "16:9",
    resolution: SEEDANCE_RESOLUTION,
    duration_secs: CLIP_SECONDS,
    generate_audio: false,
    start_frame: input.startFrame,
  };
  if (input.endFrame) body.end_frame = input.endFrame;
  return body;
}

function sniffImageMime(bytes: Buffer, contentType: string | null): InlineFrame["mime_type"] {
  const header = (contentType || "").split(";")[0].trim().toLowerCase();
  if (header === "image/jpeg" || header === "image/jpg") return "image/jpeg";
  if (header === "image/webp") return "image/webp";
  if (header === "image/png") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return "image/png";
}

async function fetchInlineFrame(url: string): Promise<InlineFrame> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Failed to download Seedance frame (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    type: "inline_base64",
    content_base64: bytes.toString("base64"),
    mime_type: sniffImageMime(bytes, res.headers.get("content-type")),
  };
}

export async function generateSeedanceClip(input: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string | null;
}): Promise<Buffer> {
  const startFrame = await fetchInlineFrame(input.startImageUrl);
  const endFrame = input.endImageUrl ? await fetchInlineFrame(input.endImageUrl) : null;
  const result = await createAndWaitForMedia({
    kind: "video",
    body: seedanceRequestBody({ prompt: input.prompt, startFrame, endFrame }),
    timeoutMs: 300_000,
  });
  return downloadMedia(result.url);
}
