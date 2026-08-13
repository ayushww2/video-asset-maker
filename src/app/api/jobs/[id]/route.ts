import { prisma } from "@/lib/db";
import { CLIP_SECONDS } from "@/lib/jobs/pipeline";
import { serializeJob } from "@/lib/serialize";
import { getSessionFromCookies } from "@/lib/session";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const job = await prisma.hookJob.findUnique({
    where: { id },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json({ job: serializeJob(job) });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let body: { retry?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.retry) return Response.json({ error: "retry is required" }, { status: 400 });

  const job = await prisma.hookJob.findUnique({
    where: { id },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  await prisma.hookScene.updateMany({
    where: { jobId: id },
    data: {
      clipUrl: null,
      clipKey: null,
      durationSec: CLIP_SECONDS,
      status: "analyzed",
      error: null,
    },
  });
  const updated = await prisma.hookJob.update({
    where: { id },
    data: {
      status: "queued",
      error: null,
      completedAt: null,
      finalVideoUrl: null,
      finalVideoKey: null,
    },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  return Response.json({ job: serializeJob(updated) });
}
