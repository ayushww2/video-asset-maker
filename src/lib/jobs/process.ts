import { prisma } from "@/lib/db";
import { getImageConcurrency, getImageCostUsd, getReasoningCostUsd } from "@/lib/env";
import { generateGptImage } from "@/lib/images/openaiImage";
import { planJob } from "@/lib/jobs/plan";
import type { JobPlan, PlannedAsset, ReferenceImage } from "@/lib/jobs/types";
import { getR2Config, uploadToR2 } from "@/lib/r2";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function promptFor(asset: PlannedAsset): string {
  const parts = [
    asset.detailedPrompt || asset.quickPrompt,
    asset.negativePrompt ? `Avoid: ${asset.negativePrompt}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

async function processOneJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (!["queued", "planning", "generating"].includes(job.status)) return;

  try {
    let plan = job.plan as JobPlan | null;
    if (!plan?.assets?.length) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "planning", updatedAt: new Date() },
      });
      const refs = Array.isArray(job.referenceImages)
        ? (job.referenceImages as ReferenceImage[])
        : [];
      const result = await planJob({
        title: job.title,
        script: job.script,
        guidance: job.guidance,
        niche: job.niche,
        mood: job.mood,
        realFootage: job.realFootage,
        assetCount: job.assetCount,
        referenceNotes: job.referenceNotes,
        referenceImages: refs,
      });
      plan = result.plan;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          plan: plan as object,
          actualReasoningCostUsd: getReasoningCostUsd(),
          actualReasoningMs: result.ms,
          actualReasoningTokens: result.tokens || null,
          progressTotal: plan.assets.length,
          status: "generating",
          updatedAt: new Date(),
        },
      });

      for (const asset of plan.assets) {
        await prisma.jobAsset.upsert({
          where: {
            jobId_assetNumber: { jobId, assetNumber: asset.assetNumber },
          },
          update: { payload: asset as object, selected: asset.selected, status: "pending" },
          create: {
            jobId,
            assetNumber: asset.assetNumber,
            selected: asset.selected,
            status: "pending",
            payload: asset as object,
          },
        });
      }
    } else if (job.status !== "generating") {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "generating", updatedAt: new Date() },
      });
    }

    const existing = await prisma.jobAsset.findMany({
      where: { jobId },
      orderBy: { assetNumber: "asc" },
    });
    const pending = existing.filter((a) => a.status !== "done");
    const concurrency = getImageConcurrency();
    const unitCost = getImageCostUsd();
    const imageStarted = Date.now();

    await runPool(pending, concurrency, async (asset) => {
      await prisma.jobAsset.update({
        where: { id: asset.id },
        data: { status: "generating", startedAt: new Date(), error: null },
      });
      try {
        const payload = (asset.payload || {}) as PlannedAsset;
        const image = await generateGptImage({ prompt: promptFor(payload) });
        const key = `video-asset-maker/jobs/${jobId}/${String(asset.assetNumber).padStart(2, "0")}.png`;
        let imageUrl: string | null = null;
        let imageR2Key: string | null = null;
        let imageBase64: string | null = null;

        if (getR2Config()) {
          const uploaded = await uploadToR2({
            key,
            body: image.bytes,
            contentType: image.contentType,
          });
          imageUrl = uploaded.url;
          imageR2Key = uploaded.key;
        } else {
          imageBase64 = image.bytes.toString("base64");
        }

        await prisma.jobAsset.update({
          where: { id: asset.id },
          data: {
            status: "done",
            imageUrl,
            imageR2Key,
            imageBase64,
            imageMimeType: image.contentType,
            costUsd: unitCost,
            completedAt: new Date(),
            error: null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Image generation failed";
        await prisma.jobAsset.update({
          where: { id: asset.id },
          data: { status: "error", error: message, completedAt: new Date() },
        });
      }

      const done = await prisma.jobAsset.count({
        where: { jobId, status: { in: ["done", "error"] } },
      });
      const imageCost = await prisma.jobAsset.aggregate({
        where: { jobId, status: "done" },
        _sum: { costUsd: true },
      });
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      const reasoning = Number(current?.actualReasoningCostUsd || 0);
      const images = Number(imageCost._sum.costUsd || 0);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progressDone: done,
          actualImageCostUsd: images,
          actualTotalCostUsd: reasoning + images,
          actualImageMs: Date.now() - imageStarted,
          updatedAt: new Date(),
        },
      });
    });

    const finalAssets = await prisma.jobAsset.findMany({ where: { jobId } });
    const failed = finalAssets.filter((a) => a.status === "error").length;
    const succeeded = finalAssets.filter((a) => a.status === "done").length;
    const imageCost = finalAssets
      .filter((a) => a.status === "done")
      .reduce((sum, a) => sum + Number(a.costUsd || 0), 0);
    const current = await prisma.job.findUnique({ where: { id: jobId } });
    const reasoning = Number(current?.actualReasoningCostUsd || 0);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: succeeded === 0 ? "failed" : "completed",
        progressDone: succeeded + failed,
        progressTotal: finalAssets.length || current?.progressTotal || 0,
        actualImageCostUsd: imageCost,
        actualTotalCostUsd: reasoning + imageCost,
        completedAt: new Date(),
        error: failed ? `${failed} asset${failed === 1 ? "" : "s"} failed to generate` : null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "failed", error: message, completedAt: new Date(), updatedAt: new Date() },
    });
  }
}

export async function runJobWorkerLoop() {
  console.log("[jobs] worker loop started");
  while (true) {
    try {
      const next = await prisma.job.findFirst({
        where: { status: { in: ["queued", "planning", "generating"] } },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        console.log(`[jobs] processing ${next.id} (${next.status})`);
        await processOneJob(next.id);
      } else {
        await sleep(2500);
      }
    } catch (error) {
      console.error("[jobs] worker tick failed", error);
      await sleep(4000);
    }
  }
}
