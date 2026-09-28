import { getImageCostUsd, getPlannerScriptMaxChars } from "@/lib/env";
import type { JobPlan, PlannedAsset, ReferenceImage } from "@/lib/jobs/types";

export const DEFAULT_NEGATIVE =
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

export function scriptForPlanner(script: string | null | undefined, assetCount: number): string {
  const s = script?.trim() || "";
  if (!s) return "(none — plan from the title and guidance)";
  const max = getPlannerScriptMaxChars();
  if (s.length <= max) return s;
  const head = Math.floor(max * 0.62);
  const tail = Math.max(500, max - head - 280);
  return `${s.slice(0, head)}

[... middle of script omitted for planning (${s.length.toLocaleString()} characters total). Spread all ${assetCount} stills across the full story arc — hook, setup, reveals, payoff — using the title, guidance, and the excerpts below. ...]

${s.slice(-tail)}`;
}

export function plannerMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: string }).text || "")
          : "",
      )
      .join("");
  }
  return "";
}

export function normalizeAsset(raw: unknown, index: number): PlannedAsset {
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

export function parsePlannerJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    }
    return {};
  }
}

export type PlannerMeta = Record<string, unknown> | null;

export function buildJobPlanFromParts(input: {
  title: string;
  referenceImages?: ReferenceImage[];
  count: number;
  meta: PlannerMeta;
  assets: PlannedAsset[];
}): JobPlan {
  const parsed = input.meta || {};
  const assets = input.assets;
  const diagnosisRaw =
    parsed.diagnosis && typeof parsed.diagnosis === "object"
      ? (parsed.diagnosis as Record<string, unknown>)
      : {};

  return {
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
      total: input.count,
      stillImages: input.count,
      smallVideos: 0,
    },
    estimatedImageCostUsd: Math.round(input.count * getImageCostUsd() * 1000) / 1000,
    assets,
  };
}
