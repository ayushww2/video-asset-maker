import {
  getImageCreditsPerImage,
  getImageCostUsd,
  isAuthEnabled,
  useElevenLabsImage,
} from "@/lib/env";

export async function GET() {
  return Response.json({
    ok: true,
    product: "video-asset-maker",
    authRequired: isAuthEnabled(),
    imageProvider: useElevenLabsImage() ? "elevenlabs" : "openai-compatible",
    imageModel: "gpt-image-2",
    imageQuality: process.env.IMAGE_QUALITY || "low",
    imageAspect: "16:9",
    imageCreditsPerImage: useElevenLabsImage() ? getImageCreditsPerImage() : null,
    imageCostUsdEstimate: getImageCostUsd(),
  });
}
