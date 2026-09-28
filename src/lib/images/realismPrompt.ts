import type { JobPlan, PlannedAsset } from "@/lib/jobs/types";

/** Prepended to every ElevenLabs / GPT Image prompt at generation time. */
export const REALISM_CAMERA_PREFIX =
  "Photoreal documentary still from a real camera in the field (35mm film scan or modern DSLR), natural ambient light, slightly bright exposure, believable contact shadows, subtle sensor grain and mild noise, imperfect micro-contrast, no beauty retouching, no AI glow, no plastic/waxy skin, no 3D render or video-game look. Full-bleed 16:9 frame filling the image edge-to-edge.";

export const REALISM_REFERENCE_LINE =
  "Match attached reference images for lighting, grain, color response, and camera character only — do not copy their exact scene, faces, layout, or composition.";

export const REALISM_NO_REFS_LINE =
  "No reference images: use restrained real-world documentary / archive / field photography — never a staged evidence board or poster composite.";

export function buildImageGenerationPrompt(
  asset: PlannedAsset,
  ctx: {
    guidance?: string | null;
    referenceStyleNotes?: string | null;
    referenceNotes?: string | null;
    hasReferences?: boolean;
    doNotShow?: string[];
    niche?: string | null;
    mood?: string | null;
  },
): string {
  const avoidParts = [
    asset.negativePrompt,
    ctx.doNotShow?.length ? ctx.doNotShow.join(", ") : "",
    "CGI, 3D render, Unreal, Octane, illustration, cinematic poster, HDR halos, oversaturated, plastic, waxy, nested screens, TVs, monitors, corkboards, evidence tables, dossiers, readable text, logos, watermarks",
  ].filter(Boolean);

  const parts = [
    REALISM_CAMERA_PREFIX,
    ctx.hasReferences ? REALISM_REFERENCE_LINE : REALISM_NO_REFS_LINE,
    ctx.guidance?.trim() ? `Studio guidance: ${ctx.guidance.trim()}` : "",
    asset.bestStyle ? `Capture style: ${asset.bestStyle}` : "",
    asset.whatItShouldShow ? `Must show: ${asset.whatItShouldShow}` : "",
    asset.shouldFeelLike ? `Should feel like: ${asset.shouldFeelLike}` : "",
    asset.detailedPrompt || asset.quickPrompt,
    ctx.referenceStyleNotes?.trim() ? `Reference style (planner): ${ctx.referenceStyleNotes.trim()}` : "",
    ctx.referenceNotes?.trim() ? `Creator reference notes: ${ctx.referenceNotes.trim()}` : "",
    ctx.niche || ctx.mood
      ? `Tone: ${[ctx.niche, ctx.mood].filter(Boolean).join(" · ")}`
      : "",
    `Avoid: ${avoidParts.join("; ")}`,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function plannerRealismRules(): string {
  return `- Every detailedPrompt must read like a single real photograph someone actually took — specify lens feel (e.g. 35mm field still, archive scan, trail-cam, ROV frame), natural light direction, and one concrete environment detail.
- Ban CGI / 3D / Unreal / plastic render look in every negativePrompt.
- Prefer imperfect, observational framing over symmetrical poster composition.`;
}

export function mergeDoNotShow(plan: JobPlan | null | undefined): string[] {
  if (!plan) return [];
  return [...(plan.doNotShow || []), ...(plan.diagnosis?.avoid || [])].filter(Boolean);
}
