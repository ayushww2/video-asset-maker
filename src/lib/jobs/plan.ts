import { createContactBoxClient, getPlannerModel } from "@/lib/contactbox";
import { getPlannerBatchSize } from "@/lib/env";
import { DEFAULT_GUIDANCE } from "@/lib/ui";
import { planJobInBatches, shouldUseBatchedPlanning } from "@/lib/jobs/planBatch";
import { plannerRealismRules } from "@/lib/images/realismPrompt";
import {
  buildJobPlanFromParts,
  normalizeAsset,
  parsePlannerJson,
  plannerMessageText,
  scriptForPlanner,
} from "@/lib/jobs/planShared";
import type { JobPlan, ReferenceImage } from "@/lib/jobs/types";

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
  const count = Math.min(25, Math.max(1, input.assetCount));
  if (shouldUseBatchedPlanning(count)) {
    return planJobInBatches(input);
  }

  const client = createContactBoxClient();
  const started = Date.now();
  const guidance = input.guidance || DEFAULT_GUIDANCE;

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
${plannerRealismRules()}
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
${scriptForPlanner(input.script, count)}

Reference notes:
${input.referenceNotes?.trim() || "(none)"}
Reference images provided: ${input.referenceImages?.length || 0} (match style dialogue, do not copy scenes).`;

  const model = getPlannerModel();
  console.log(
    `[plan] start title=${JSON.stringify(input.title.slice(0, 48))} assets=${count} scriptChars=${input.script?.length || 0}`,
  );
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  console.log(`[plan] done model=${model} ms=${Date.now() - started}`);

  const choice = completion.choices?.[0];
  const text = plannerMessageText(choice?.message?.content);
  if (!text.trim()) {
    const hint =
      !completion.choices?.length
        ? "Planner returned no choices (check CONTACTBOX_API_KEY and REASONING_MODEL)."
        : "Planner returned empty content.";
    throw new Error(hint);
  }

  const parsed = parsePlannerJson(text);
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
        },
        n - 1,
      ),
    );
  }

  const plan = buildJobPlanFromParts({
    title: input.title,
    referenceImages: input.referenceImages,
    count,
    meta: parsed,
    assets,
  });

  const tokens =
    (completion.usage?.total_tokens as number | undefined) ||
    ((completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0));

  return { plan, tokens, ms: Date.now() - started };
}
