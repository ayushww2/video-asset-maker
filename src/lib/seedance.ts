import { createGateway, experimental_generateVideo as generateVideo } from "ai";
import { CLIP_SECONDS } from "@/lib/jobs/pipeline";

export const SEEDANCE_MODEL_ID = "bytedance/seedance-v1.5-pro";
// Seedance 1.5 Pro's first+last-frame ("flf2v") mode rejects 480p — only 720p/1080p are valid there,
// even though 480p is priced and allowed for plain single-frame i2v. Generate at 720p and let the
// ffmpeg assemble step (which already force-scales every clip to 854x480) bring it down to 480p.
export const SEEDANCE_RESOLUTION = "1280x720" as const;

export const I2V_SUFFIX =
  "Use the uploaded image as the exact reference frame. Preserve the same composition, objects, lighting, and documentary style. Do not redesign the scene. Animate only subtle believable movement. Keep the motion practical, restrained, and realistic, as if this is real recovered footage.";

export function withI2vSuffix(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes("Use the uploaded image as the exact reference frame")) return trimmed;
  return `${trimmed}\n\n${I2V_SUFFIX}`;
}

export type SeedanceFrameImage = {
  image: string;
  frameType: "first_frame" | "last_frame";
};

export function gatewayApiKey(): string {
  return (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY || "").trim();
}

export function seedanceRequest(input: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string | null;
}) {
  const frameImages: SeedanceFrameImage[] = [{ image: input.startImageUrl, frameType: "first_frame" }];
  if (input.endImageUrl) {
    frameImages.push({ image: input.endImageUrl, frameType: "last_frame" });
  }
  return {
    model: SEEDANCE_MODEL_ID,
    prompt: withI2vSuffix(input.prompt),
    duration: CLIP_SECONDS,
    aspectRatio: "16:9" as const,
    resolution: SEEDANCE_RESOLUTION,
    generateAudio: false as const,
    frameImages,
    providerOptions: {
      bytedance: {
        watermark: false,
        pollTimeoutMs: 600_000,
      },
    },
  };
}

export async function generateSeedanceClip(input: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string | null;
}): Promise<Buffer> {
  const apiKey = gatewayApiKey();
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is not set");

  const gateway = createGateway({ apiKey });
  const request = seedanceRequest(input);
  const result = await generateVideo({
    model: gateway.video(SEEDANCE_MODEL_ID),
    prompt: request.prompt,
    duration: request.duration,
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    generateAudio: request.generateAudio,
    frameImages: request.frameImages,
    providerOptions: request.providerOptions,
    poll: {
      intervalMs: 5_000,
      timeoutMs: 600_000,
    },
  });

  const bytes = result.video?.uint8Array;
  if (!bytes?.length) throw new Error("Seedance 1.5 Pro returned no video");
  return Buffer.from(bytes);
}
