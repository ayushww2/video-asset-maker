import ShareJob from "@/components/ShareJob";
import { prisma } from "@/lib/db";
import { serializeAsset, serializeJob } from "@/lib/serialize";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function JobSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();
  const assets = await prisma.jobAsset.findMany({
    where: { jobId: id },
    orderBy: { assetNumber: "asc" },
  });

  return (
    <ShareJob
      initialJob={serializeJob(job)}
      initialAssets={assets.map((asset) => serializeAsset(asset, true))}
    />
  );
}
