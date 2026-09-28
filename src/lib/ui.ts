export type JobRecord = {
  id: string;
  title: string;
  script: string | null;
  guidance: string | null;
  niche: string | null;
  mood: string | null;
  realFootage: string | null;
  assetCount: number;
  referenceNotes: string | null;
  ownerUsername: string | null;
  status: string;
  plan: { diagnosis?: { titlePromise?: string } } | null;
  estimate: {
    totalCostUsd?: number;
    totalSeconds?: number;
    reasoningCostUsd?: number;
    imageCostUsd?: number;
    imageConcurrency?: number;
    imageBatches?: number;
    assetCount?: number;
    imageSeconds?: number;
    reasoningSeconds?: number;
    breakdown?: string;
  } | null;
  actualReasoningCostUsd: number | null;
  actualImageCostUsd: number | null;
  actualTotalCostUsd: number | null;
  actualReasoningMs: number | null;
  actualImageMs: number | null;
  actualReasoningTokens: number | null;
  progressDone: number;
  progressTotal: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AssetRecord = {
  id: string;
  jobId?: string;
  assetNumber: number;
  selected?: boolean;
  status: string;
  payload?: {
    assetName?: string;
    scriptPlacement?: string;
    scriptExcerpt?: string;
  } | null;
  imageUrl?: string | null;
  imageR2Key?: string | null;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  costUsd?: number | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export function assetSrc(asset: AssetRecord): string | null {
  if (asset.imageUrl) return asset.imageUrl;
  if (asset.imageBase64) {
    return `data:${asset.imageMimeType || "image/png"};base64,${asset.imageBase64}`;
  }
  return null;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(3)}`;
}

export function formatSeconds(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function statusClass(status: string): string {
  if (status === "completed") return "text-[var(--ok)]";
  if (status === "failed") return "text-[var(--danger)]";
  if (status === "generating" || status === "planning") return "text-[var(--accent)]";
  return "text-[var(--muted)]";
}

export const NICHES = [
  "mystery",
  "history",
  "archaeology",
  "religion",
  "science",
  "space",
  "crime",
  "celebrity",
  "royal family",
  "other",
];

export const DEFAULT_GUIDANCE =
  "Photoreal real-camera photos in real-world light — slightly brighter natural exposure, believable contact shadows, subjects settled into the scene. Mild grain/noise OK; no CGI / 3D / plastic render look. Full-bleed subject (field photo, archive still, CCTV-look, underwater survey). NEVER TVs/monitors, evidence tables, corkboards, or dossiers. No readable text.";
