import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const MAX_JOB_AUTO_RETRIES = 3;

export function isRetryableJobError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("planner returned") ||
    m.includes("planning timed out")
  );
}

export function autoRetryCountFromEstimate(estimate: unknown): number {
  if (!estimate || typeof estimate !== "object") return 0;
  const n = Number((estimate as Record<string, unknown>).autoRetryCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function requeueJobForRetry(jobId: string, nextRetryCount: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const estimate =
    job.estimate && typeof job.estimate === "object"
      ? { ...(job.estimate as Record<string, unknown>), autoRetryCount: nextRetryCount }
      : { autoRetryCount: nextRetryCount };

  await prisma.jobAsset.deleteMany({ where: { jobId } });
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "queued",
      plan: Prisma.JsonNull,
      error: null,
      progressDone: 0,
      progressTotal: job.assetCount,
      actualReasoningCostUsd: null,
      actualImageCostUsd: null,
      actualTotalCostUsd: null,
      actualReasoningMs: null,
      actualImageMs: null,
      actualReasoningTokens: null,
      completedAt: null,
      estimate: estimate as object,
      updatedAt: new Date(),
    },
  });
  console.log(`[jobs] auto-requeued ${jobId} (retry ${nextRetryCount}/${MAX_JOB_AUTO_RETRIES})`);
}

/** Failed planning timeouts and stale "planning" rows → queued again. */
export async function recoverStuckAndFailedJobs(limit = 5) {
  const staleMs = 12 * 60 * 1000;
  const staleBefore = new Date(Date.now() - staleMs);

  const stalePlanning = await prisma.job.findMany({
    where: { status: "planning", updatedAt: { lt: staleBefore } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  for (const job of stalePlanning) {
    console.log(`[jobs] stale planning reset ${job.id}`);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "queued", error: null, updatedAt: new Date() },
    });
  }

  const failed = await prisma.job.findMany({
    where: { status: "failed" },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  for (const job of failed) {
    if (!isRetryableJobError(job.error)) continue;
    const retries = autoRetryCountFromEstimate(job.estimate);
    if (retries >= MAX_JOB_AUTO_RETRIES) continue;
    await requeueJobForRetry(job.id, retries + 1);
  }
}
