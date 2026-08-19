import { prisma } from "@/lib/db";
import { ingestStill } from "@/lib/images/ingest";
import { CLIP_SECONDS, SCENE_COUNT } from "@/lib/jobs/pipeline";
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
  const title = String(form.get("title") || "").trim() || "12s clip";

  const job = await prisma.hookJob.create({
    data: {
      title,
      kind: "clip",
      ownerUsername: user.username,
      status: "queued",
      sceneCount: SCENE_COUNT,
      progressDone: 0,
      progressTotal: SCENE_COUNT + 1,
    },
  });

  try {
    for (let n = 1; n <= SCENE_COUNT; n++) {
      const prompt = String(form.get(`prompt${n}`) || form.get("prompt") || "").trim();
      const startFile = form.get(`start${n}`);
      const endFile = form.get(`end${n}`);
      const startUrl = String(form.get(`startUrl${n}`) || "").trim();
      const endUrl = String(form.get(`endUrl${n}`) || "").trim();
      const hasStart = (startFile instanceof File && startFile.size > 0) || Boolean(startUrl);
      const hasEnd = (endFile instanceof File && endFile.size > 0) || Boolean(endUrl);
      if (!hasStart || !hasEnd) {
        throw new Error(`Scene ${n} needs a start still and an end still`);
      }
      if (!prompt) throw new Error(`Scene ${n} needs a motion prompt`);
      const start = await ingestStill({
        key: `clips/${job.id}/scene-${n}-start`,
        file: startFile instanceof File ? startFile : null,
        url: startUrl,
      });
      const end = await ingestStill({
        key: `clips/${job.id}/scene-${n}-end`,
        file: endFile instanceof File ? endFile : null,
        url: endUrl,
      });
      if (!start || !end) throw new Error(`Scene ${n} stills failed to upload`);
      await prisma.hookScene.create({
        data: {
          jobId: job.id,
          sceneNumber: n,
          purpose: `scene ${n}`,
          durationSec: CLIP_SECONDS,
          i2vPrompt: prompt,
          startImageUrl: start.url,
          startImageKey: start.key,
          endImageUrl: end.url,
          endImageKey: end.key,
          status: "queued",
        },
      });
    }
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
