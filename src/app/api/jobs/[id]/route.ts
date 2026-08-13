import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { serializeAsset, serializeJob } from "@/lib/serialize";

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
