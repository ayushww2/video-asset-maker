import type { ReferenceImage } from "@/lib/jobs/types";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type ElevenLabsInlineImage = {
  type: "inline_base64";
  content_base64: string;
  mime_type: string;
};

/** Parse job reference data URLs into ElevenLabs inline_base64 refs (max 10 per API). */
export function toElevenLabsReferenceImages(
  refs: ReferenceImage[] | undefined | null,
  max = 8,
): ElevenLabsInlineImage[] {
  if (!refs?.length) return [];
  const out: ElevenLabsInlineImage[] = [];
  for (const ref of refs) {
    if (out.length >= max) break;
    const raw = ref.dataUrl || "";
    const match = raw.match(/^data:([^;]+);base64,([\s\S]+)$/i);
    if (!match) continue;
    let mime = (match[1] || ref.mimeType || "image/png").trim().toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      if (mime === "image/jpg") mime = "image/jpeg";
      else continue;
    }
    const content_base64 = match[2].replace(/\s/g, "");
    if (!content_base64) continue;
    out.push({ type: "inline_base64", content_base64, mime_type: mime });
  }
  return out;
}
