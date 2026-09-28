import type OpenAI from "openai";
import { createContactBoxClient, getPlannerModel } from "@/lib/contactbox";
import { getPlannerBatchSize } from "@/lib/env";
import { DEFAULT_GUIDANCE } from "@/lib/ui";
import type { PlannedAsset, ReferenceImage } from "@/lib/jobs/types";
import { plannerRealismRules } from "@/lib/images/realismPrompt";
import {
  buildJobPlanFromParts,
  normalizeAsset,
  parsePlannerJson,
  plannerMessageText,
  scriptForPlanner,
  type PlannerMeta,
} from "@/lib/jobs/planShared";

function batchRanges(total: number, batchSize: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 1; start <= total; start += batchSize) {
    ranges.push({ start, end: Math.min(total, start + batchSize - 1) });
  }
  return ranges;
}

async function runPlannerCall(
  client: OpenAI,
  system: string,
  user: string,
): Promise<{ text: string; tokens: number }> {
  const completion = await client.chat.completions.create({
    model: getPlannerModel(),
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const choice = completion.choices?.[0];
  const text = plannerMessageText(choice?.message?.content);
  if (!text.trim()) {
    throw new Error(
      !completion.choices?.length
        ? "Planner returned no choices (check CONTACTBOX_API_KEY and REASONING_MODEL)."
        : "Planner returned empty content.",
    );
  }
  const tokens =
    (completion.usage?.total_tokens as number | undefined) ||
    ((completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0));
  return { text, tokens };
}

function baseUserContext(input: {
  title: string;
  script?: string | null;
  guidance?: string | null;
  niche?: string | null;
  mood?: string | null;
  realFootage?: string | null;
  assetCount: number;
  referenceNotes?: string | null;
  referenceImages?: ReferenceImage[];
}): string {
  const guidance = input.guidance || DEFAULT_GUIDANCE;
  return `Title: ${input.title}
Niche: ${input.niche || "mystery"}
Mood: ${input.mood || "investigative / suspenseful"}
Real footage availability: ${input.realFootage || "LOW"}
Total asset count for this job: ${input.assetCount}
Guidance:
${guidance}

Script (optional):
${scriptForPlanner(input.script, input.assetCount)}

Reference notes:
${input.referenceNotes?.trim() || "(none)"}
Reference images provided: ${input.referenceImages?.length || 0} (match style dialogue, do not copy scenes).`;
}

export async function planJobInBatches(input: {
  title: string;
  script?: string | null;
  guidance?: string | null;
  niche?: string | null;
  mood?: string | null;
  realFootage?: string | null;
  assetCount: number;
  referenceNotes?: string | null;
  referenceImages?: ReferenceImage[];
}): Promise<{ plan: import("@/lib/jobs/types").JobPlan; tokens: number; ms: number }> {
  const started = Date.now();
  const count = Math.min(25, Math.max(1, input.assetCount));
  const batchSize = getPlannerBatchSize();
  const client = createContactBoxClient();
  const ranges = batchRanges(count, batchSize);
  let totalTokens = 0;
  let meta: PlannerMeta | null = null;
  const allAssets: PlannedAsset[] = [];

  console.log(
    `[plan] batched title=${JSON.stringify(input.title.slice(0, 48))} assets=${count} batches=${ranges.length} scriptChars=${input.script?.length || 0}`,
  );

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const n = end - start + 1;
    const includeMeta = i === 0;
    const prior =
      allAssets.length > 0
        ? `Already planned assets (do not duplicate): ${allAssets.map((a) => `#${a.assetNumber} ${a.assetName}`).join("; ")}`
        : "";

    const system = includeMeta
      ? `You are the planner for Video Asset Maker, a documentary stills studio for mystery YouTube films.
Return ONLY valid JSON with diagnosis, styleMix, checklist, doNotShow, hookOrder, editorNote, referenceStyleNotes, recommendedCount, and assets for assetNumber ${start} through ${end} (${n} assets).

Each asset MUST include:
assetNumber (${start}..${end}), assetName, selected (true), priority, whereToUse (hook|setup|major reveal|payoff), bestStyle, editorMove, labelNeeded, suggestedLabel, scriptExcerpt, scriptPlacement, scriptWordStart, scriptWordEnd, whyItMatters, whatItShouldShow, shouldFeelLike, quickPrompt, detailedPrompt, negativePrompt.

Rules: still images only; 16:9 photoreal real-camera; no readable text/TVs/corkboards.
${plannerRealismRules()}`
      : `You are continuing a Video Asset Maker plan. Return ONLY valid JSON: { "assets": [ exactly ${n} assets numbered ${start}..${end} ] } with the same per-asset fields as before. Do not repeat earlier assets.`;

    const user = `${baseUserContext({ ...input, assetCount: count })}

This batch: plan assetNumber ${start} through ${end} only (${n} stills). Spread them across the script timeline — batch ${i + 1} of ${ranges.length}.
${prior}`;

    const { text, tokens } = await runPlannerCall(client, system, user);
    totalTokens += tokens;
    const parsed = parsePlannerJson(text);
    if (includeMeta) {
      meta = parsed;
    }
    const rawAssets = Array.isArray(parsed.assets) ? parsed.assets : [];
    for (let j = 0; j < n; j++) {
      const num = start + j;
      const raw = rawAssets[j] ?? rawAssets.find((a) => normalizeAsset(a, num - 1).assetNumber === num);
      allAssets.push(normalizeAsset(raw ?? { assetNumber: num }, num - 1));
    }
    console.log(`[plan] batch ${i + 1}/${ranges.length} assets ${start}-${end} ok`);
  }

  while (allAssets.length < count) {
    const num = allAssets.length + 1;
    allAssets.push(
      normalizeAsset(
        {
          assetNumber: num,
          assetName: `Evidence still ${num}`,
          detailedPrompt: `Documentary evidence still for: ${input.title}. Full-bleed 16:9 photoreal real-camera photo.`,
        },
        num - 1,
      ),
    );
  }

  const plan = buildJobPlanFromParts({
    title: input.title,
    referenceImages: input.referenceImages,
    count,
    meta,
    assets: allAssets.slice(0, count),
  });

  console.log(`[plan] batched done ms=${Date.now() - started} tokens=${totalTokens}`);
  return { plan, tokens: totalTokens, ms: Date.now() - started };
}

export function shouldUseBatchedPlanning(assetCount: number): boolean {
  return assetCount > getPlannerBatchSize();
}
