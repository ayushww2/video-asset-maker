import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { serializeAsset, serializeJob } from "@/lib/serialize";
import { getSessionOrPublic } from "@/lib/session";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const includeImages = new URL(req.url).searchParams.get("images") === "1";
  const assets = await prisma.jobAsset.findMany({
    where: { jobId: id },
    orderBy: { assetNumber: "asc" },
  });

  return Response.json({
    job: serializeJob(job),
    assets: assets.map((asset) => serializeAsset(asset, includeImages)),
  });
}

/** Re-queue a failed job (clears plan so planning runs again). */
export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionOrPublic();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "failed") {
    return Response.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }

  await prisma.jobAsset.deleteMany({ where: { jobId: id } });
  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: "queued",
      plan: null,
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
      updatedAt: new Date(),
    },
  });

  return Response.json({ job: serializeJob(updated) });
}
