import { createContactBoxClient, getPlannerModel } from "@/lib/contactbox";
import { getImageCostUsd } from "@/lib/env";
import type { JobPlan, PlannedAsset, ReferenceImage } from "@/lib/jobs/types";

const DEFAULT_NEGATIVE =
  "CGI, 3D render, Unreal Engine, Octane, Blender, plastic, waxy, oversmooth, video game, concept art, illustration, HDR glow, cinematic poster, TV screen, CRT monitor, computer monitor, nested screen, evidence table, corkboard, bulletin board, investigation board, dossier on desk, photo of a screen, screen in screen";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function normalizeAsset(raw: unknown, index: number): PlannedAsset {
  const a = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const assetNumber = asNumber(a.assetNumber, index + 1);
  const excerpt = asString(a.scriptExcerpt);
  return {
    assetNumber,
    assetName: asString(a.assetName, `Asset ${assetNumber}`),
    selected: a.selected === false ? false : true,
    priority: asString(a.priority, "High"),
    whereToUse: asString(a.whereToUse, "hook"),
    bestStyle: asString(a.bestStyle, "field photo"),
    editorMove: asString(a.editorMove),
    labelNeeded: asBool(a.labelNeeded, true),
    suggestedLabel: asString(a.suggestedLabel, "visual recreation"),
    scriptExcerpt: excerpt,
    scriptPlacement:
      asString(a.scriptPlacement) ||
      (excerpt ? `Use when it says about ${excerpt}` : "Use when it says about this moment in the script"),
    scriptWordStart: asNumber(a.scriptWordStart, 1),
    scriptWordEnd: asNumber(a.scriptWordEnd, 0),
    whyItMatters: asString(a.whyItMatters),
    whatItShouldShow: asString(a.whatItShouldShow),
    shouldFeelLike: asString(a.shouldFeelLike),
    quickPrompt: asString(a.quickPrompt),
    detailedPrompt: asString(a.detailedPrompt) || asString(a.quickPrompt),
    negativePrompt: asString(a.negativePrompt, DEFAULT_NEGATIVE),
  };
}

export async function planJob(input: {
  title: string;
  script?: string | null;
  guidance?: string | null;
  niche?: string | null;
  mood?: string | null;
  realFootage?: string | null;
  assetCount: number;
  referenceNotes?: string | null;
  referenceImages?: ReferenceImage[];
}): Promise<{ plan: JobPlan; tokens: number; ms: number }> {
  const client = createContactBoxClient();
  const started = Date.now();
  const count = Math.min(25, Math.max(1, input.assetCount));
  const guidance =
    input.guidance ||
    "Photoreal real-camera photos in real-world light — slightly brighter natural exposure, believable contact shadows, subjects settled into the scene. Mild grain/noise OK; no CGI / 3D / plastic render look. Full-bleed subject (field photo, archive still, CCTV-look, underwater survey). NEVER TVs/monitors, evidence tables, corkboards, or dossiers. No readable text.";

  const system = `You are the planner for Video Asset Maker, a documentary stills studio for mystery YouTube films.
Return ONLY valid JSON with this shape:
{
  "diagnosis": {
    "titlePromise": string,
    "viewerExpectation": string,
    "bestEvidenceStyles": string[],
    "avoid": string[]
  },
  "styleMix": [{"style": string, "why": string}],
  "checklist": string[],
  "doNotShow": string[],
  "hookOrder": number[],
  "editorNote": string,
  "referenceStyleNotes": string,
  "recommendedCount": {"total": number, "stillImages": number, "smallVideos": 0},
  "assets": [ ... exactly ${count} assets ... ]
}

Each asset MUST include:
assetNumber (1..${count}), assetName, selected (true), priority, whereToUse (hook|setup|major reveal|payoff), bestStyle, editorMove, labelNeeded, suggestedLabel, scriptExcerpt, scriptPlacement ("Use when it says about …"), scriptWordStart, scriptWordEnd, whyItMatters, whatItShouldShow, shouldFeelLike, quickPrompt, detailedPrompt, negativePrompt.

Rules:
- Still images only. Zero videos.
- Full-bleed direct views of the subject or story scene. 16:9 photoreal real-camera.
- Match uploaded reference *style* if any, but never repeat those scenes.
- No readable text, logos, timestamps, fake documents, TVs/monitors, corkboards, evidence tables, dossiers.
- Ban CGI / 3D / Unreal / Octane / plastic render look in every negativePrompt.
- Every detailedPrompt must specify photorealistic real-camera texture, slightly brighter natural exposure, and the meta-shot bans.
- Historical / scientific recreations should be labeled (visual recreation / dramatized visual).
- Keep claims visually conditional. Do not invent proof.`;

  const user = `Title: ${input.title}
Niche: ${input.niche || "mystery"}
Mood: ${input.mood || "investigative / suspenseful"}
Real footage availability: ${input.realFootage || "LOW"}
Asset count: ${count}
Guidance:
${guidance}

Script (optional):
${input.script?.trim() || "(none — plan from the title and guidance)"}

Reference notes:
${input.referenceNotes?.trim() || "(none)"}
Reference images provided: ${input.referenceImages?.length || 0} (match style dialogue, do not copy scenes).`;

  const completion = await client.chat.completions.create({
    model: getPlannerModel(),
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    }
  }

  const rawAssets = Array.isArray(parsed.assets) ? parsed.assets : [];
  const assets = rawAssets.slice(0, count).map((a, i) => normalizeAsset(a, i));
  while (assets.length < count) {
    const n = assets.length + 1;
    assets.push(
      normalizeAsset(
        {
          assetNumber: n,
          assetName: `Evidence still ${n}`,
          detailedPrompt: `${guidance} Documentary evidence still for: ${input.title}. Full-bleed 16:9 photoreal real-camera photo, no readable text.`,
          negativePrompt: DEFAULT_NEGATIVE,
        },
        n - 1,
      ),
    );
  }

  const diagnosisRaw =
    parsed.diagnosis && typeof parsed.diagnosis === "object"
      ? (parsed.diagnosis as Record<string, unknown>)
      : {};

  const plan: JobPlan = {
    diagnosis: {
      titlePromise: asString(diagnosisRaw.titlePromise, input.title),
      viewerExpectation: asString(diagnosisRaw.viewerExpectation),
      bestEvidenceStyles: asStringArray(diagnosisRaw.bestEvidenceStyles),
      avoid: asStringArray(diagnosisRaw.avoid),
    },
    styleMix: Array.isArray(parsed.styleMix)
      ? parsed.styleMix
          .map((row) => {
            const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
            return { style: asString(r.style), why: asString(r.why) };
          })
          .filter((r) => r.style)
      : [],
    checklist: asStringArray(parsed.checklist),
    doNotShow: asStringArray(parsed.doNotShow),
    hookOrder: Array.isArray(parsed.hookOrder)
      ? parsed.hookOrder.map((n) => asNumber(n)).filter((n) => n > 0)
      : assets.slice(0, 5).map((a) => a.assetNumber),
    editorNote: asString(parsed.editorNote),
    referenceStyleNotes: asString(
      parsed.referenceStyleNotes,
      input.referenceImages?.length
        ? "Match the uploaded references for lighting, grain, and camera texture. Do not repeat their scenes."
        : "No reference images were provided. Use restrained documentary / archive photography.",
    ),
    recommendedCount: {
      total: count,
      stillImages: count,
      smallVideos: 0,
    },
    estimatedImageCostUsd: Math.round(count * getImageCostUsd() * 1000) / 1000,
    assets,
  };

  const tokens =
    (completion.usage?.total_tokens as number | undefined) ||
    ((completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0));

  return { plan, tokens, ms: Date.now() - started };
}
