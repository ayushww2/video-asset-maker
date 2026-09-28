import type { Job, JobAsset, Prisma } from "@prisma/client";
import type { AssetRecord, JobRecord } from "@/lib/ui";

function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

export function serializeJob(job: Job): JobRecord {
  return {
    id: job.id,
    title: job.title,
    script: job.script,
    guidance: job.guidance,
    niche: job.niche,
    mood: job.mood,
    realFootage: job.realFootage,
    assetCount: job.assetCount,
    referenceNotes: job.referenceNotes,
    ownerUsername: job.ownerUsername,
    status: job.status,
    plan: job.plan as JobRecord["plan"],
    estimate: job.estimate as JobRecord["estimate"],
    actualReasoningCostUsd: num(job.actualReasoningCostUsd),
    actualImageCostUsd: num(job.actualImageCostUsd),
    actualTotalCostUsd: num(job.actualTotalCostUsd),
    actualReasoningMs: job.actualReasoningMs,
    actualImageMs: job.actualImageMs,
    actualReasoningTokens: job.actualReasoningTokens,
    progressDone: job.progressDone,
    progressTotal: job.progressTotal,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}

export function serializeAsset(asset: JobAsset, includeImageBody = true): AssetRecord {
  return {
    id: asset.id,
    jobId: asset.jobId,
    assetNumber: asset.assetNumber,
    selected: asset.selected,
    status: asset.status,
    payload: asset.payload as AssetRecord["payload"],
    imageUrl: asset.imageUrl,
    imageR2Key: asset.imageR2Key,
    imageMimeType: asset.imageMimeType,
    imageBase64: includeImageBody ? asset.imageBase64 : null,
    costUsd: num(asset.costUsd),
    error: asset.error,
    startedAt: asset.startedAt ? asset.startedAt.toISOString() : null,
    completedAt: asset.completedAt ? asset.completedAt.toISOString() : null,
  };
}
