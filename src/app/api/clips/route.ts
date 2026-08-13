import { prisma } from "@/lib/db";
import { ingestStill } from "@/lib/images/ingest";
import { enqueueAllowed } from "@/lib/jobs/process";
import { serializeJob } from "@/lib/serialize";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const capacity = await enqueueAllowed();
  if (!capacity.ok) {
    return Response.json(
      { error: `Daily cap reached (${capacity.used}/${capacity.cap}).` },
      { status: 429 },
    );
  }

  const form = await req.formData();
  const title = String(form.get("title") || "").trim() || "Clip";
  const prompt = String(form.get("prompt") || "").trim();
  if (!prompt) return Response.json({ error: "Motion prompt is required" }, { status: 400 });

  const startFile = form.get("start");
  const endFile = form.get("end");
  const startUrl = String(form.get("startUrl") || "").trim();
  const endUrl = String(form.get("endUrl") || "").trim();
  if (!(startFile instanceof File && startFile.size > 0) && !startUrl) {
    return Response.json({ error: "Upload a start still or paste a still URL" }, { status: 400 });
  }

  const job = await prisma.hookJob.create({
    data: {
      title,
      kind: "clip",
      ownerUsername: user.username,
      status: "queued",
      sceneCount: 1,
      progressDone: 0,
      progressTotal: 1,
    },
  });

  try {
    const start = await ingestStill({
      key: `clips/${job.id}/start`,
      file: startFile instanceof File ? startFile : null,
      url: startUrl,
    });
    if (!start) throw new Error("Start still is required");
    const end = await ingestStill({
      key: `clips/${job.id}/end`,
      file: endFile instanceof File ? endFile : null,
      url: endUrl,
    });
    await prisma.hookScene.create({
      data: {
        jobId: job.id,
        sceneNumber: 1,
        purpose: "clip",
        durationSec: 6,
        i2vPrompt: prompt,
        startImageUrl: start.url,
        startImageKey: start.key,
        endImageUrl: end?.url || null,
        endImageKey: end?.key || null,
        status: "queued",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not ingest stills";
    await prisma.hookJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    return Response.json({ error: message }, { status: 400 });
  }

  const created = await prisma.hookJob.findUnique({
    where: { id: job.id },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  return Response.json({ job: serializeJob(created!), capacity });
}
