import { prisma } from "@/lib/db";
import { combineHookClips } from "@/lib/ffmpeg";
import { generateGptImage } from "@/lib/images/gptImage";
import { analyzeAssembly, analyzeStartEndFrames } from "@/lib/jobs/analyzeFrames";
import { planHook, type HookPlan } from "@/lib/jobs/planner";
import { maxHooksPerDay } from "@/lib/env";
import { uploadToR2 } from "@/lib/r2";
import { generateSeedanceClip } from "@/lib/seedance";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setProgress(jobId: string, done: number, extra: Record<string, unknown> = {}) {
  await prisma.hookJob.update({
    where: { id: jobId },
    data: { progressDone: done, updatedAt: new Date(), ...extra },
  });
}

export async function todayJobCount(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.hookJob.count({
    where: { createdAt: { gte: start }, status: { not: "failed" } },
  });
}

async function processJob(jobId: string) {
  const job = await prisma.hookJob.findUnique({
    where: { id: jobId },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  if (!job) return;
  if (!["queued", "planning", "imaging", "analyzing", "animating", "voicing", "combining"].includes(job.status)) {
    return;
  }

  if (job.kind === "clip") {
    await processClipJob(jobId);
    return;
  }

  try {
    let plan = job.plan as HookPlan | null;
    if (!plan?.scenes?.length) {
      await prisma.hookJob.update({ where: { id: jobId }, data: { status: "planning" } });
      plan = await planHook({ title: job.title, script: job.script });
      const total = 1 + plan.sceneCount * 4 + 1;
      await prisma.hookJob.update({
        where: { id: jobId },
        data: {
          plan: plan as object,
          sceneCount: plan.sceneCount,
          progressTotal: total,
          progressDone: 1,
          status: "imaging",
        },
      });
      for (const scene of plan.scenes) {
        await prisma.hookScene.upsert({
          where: { jobId_sceneNumber: { jobId, sceneNumber: scene.sceneNumber } },
          update: {
            purpose: scene.purpose,
            durationSec: 6,
            whatViewerSees: scene.whatViewerSees,
            curiosity: scene.curiosity,
            startPrompt: scene.startPrompt,
            endPrompt: scene.endPrompt,
            i2vPrompt: scene.i2vPrompt,
            status: "pending",
          },
          create: {
            jobId,
            sceneNumber: scene.sceneNumber,
            purpose: scene.purpose,
            durationSec: 6,
            whatViewerSees: scene.whatViewerSees,
            curiosity: scene.curiosity,
            startPrompt: scene.startPrompt,
            endPrompt: scene.endPrompt,
            i2vPrompt: scene.i2vPrompt,
            status: "pending",
          },
        });
      }
    }

    const scenes = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });

    await prisma.hookJob.update({ where: { id: jobId }, data: { status: "imaging" } });
    let done = 1;
    for (const scene of scenes) {
      if (!scene.startImageUrl && scene.startPrompt) {
        const bytes = await generateGptImage(scene.startPrompt);
        const key = `hooks/${jobId}/scene-${scene.sceneNumber}-start.png`;
        const uploaded = await uploadToR2({ key, body: bytes, contentType: "image/png" });
        await prisma.hookScene.update({
          where: { id: scene.id },
          data: { startImageUrl: uploaded.url, startImageKey: uploaded.key, status: "imaging" },
        });
      }
      done += 1;
      await setProgress(jobId, done);
      if (!scene.endImageUrl && scene.endPrompt) {
        const bytes = await generateGptImage(scene.endPrompt);
        const key = `hooks/${jobId}/scene-${scene.sceneNumber}-end.png`;
        const uploaded = await uploadToR2({ key, body: bytes, contentType: "image/png" });
        await prisma.hookScene.update({
          where: { id: scene.id },
          data: { endImageUrl: uploaded.url, endImageKey: uploaded.key },
        });
      }
      done += 1;
      await setProgress(jobId, done);
    }

    await prisma.hookJob.update({ where: { id: jobId }, data: { status: "analyzing" } });
    const imaged = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });
    for (const scene of imaged) {
      if (!scene.startImageUrl || !scene.endImageUrl) continue;
      const analysis = await analyzeStartEndFrames({
        title: job.title,
        sceneNumber: scene.sceneNumber,
        evidenceStyle: scene.purpose || "recovered footage",
        startImageUrl: scene.startImageUrl,
        endImageUrl: scene.endImageUrl,
        draftI2vPrompt: scene.i2vPrompt || "",
      });
      await prisma.hookScene.update({
        where: { id: scene.id },
        data: {
          frameAnalysis: analysis as object,
          i2vPrompt: analysis.refinedI2vPrompt,
          status: "analyzed",
        },
      });
      done += 1;
      await setProgress(jobId, done);
    }

    await prisma.hookJob.update({ where: { id: jobId }, data: { status: "animating" } });
    const ready = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });
    for (const scene of ready) {
      if (scene.clipUrl) {
        done += 1;
        await setProgress(jobId, done);
        continue;
      }
      if (!scene.startImageUrl) {
        throw new Error(`Scene ${scene.sceneNumber} missing start frame`);
      }
      await prisma.hookScene.update({ where: { id: scene.id }, data: { status: "animating" } });
      const clip = await generateSeedanceClip({
        prompt: scene.i2vPrompt || "",
        startImageUrl: scene.startImageUrl,
        endImageUrl: scene.endImageUrl,
      });
      const key = `hooks/${jobId}/scene-${scene.sceneNumber}.mp4`;
      const uploaded = await uploadToR2({ key, body: clip, contentType: "video/mp4" });
      await prisma.hookScene.update({
        where: { id: scene.id },
        data: { clipUrl: uploaded.url, clipKey: uploaded.key, status: "done" },
      });
      done += 1;
      await setProgress(jobId, done);
    }

    await prisma.hookJob.update({ where: { id: jobId }, data: { status: "combining" } });
    const finalScenes = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });
    const assembly = await analyzeAssembly({
      title: job.title,
      sceneSummaries: finalScenes.map(
        (s) => `${s.purpose || "scene"} — ${s.whatViewerSees || ""}`,
      ),
    });
    const order = assembly.clipOrder.length ? assembly.clipOrder : finalScenes.map((s) => s.sceneNumber);
    const ordered = order
      .map((n) => finalScenes.find((s) => s.sceneNumber === n))
      .filter((s): s is (typeof finalScenes)[number] => Boolean(s && s.clipUrl));

    const clipBuffers: Buffer[] = [];
    for (const scene of ordered) {
      const res = await fetch(scene.clipUrl!, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`Failed to fetch scene ${scene.sceneNumber} clip`);
      clipBuffers.push(Buffer.from(await res.arrayBuffer()));
    }
    if (!clipBuffers.length) throw new Error("No Seedance clips to assemble");
    const combined =
      clipBuffers.length === 1
        ? clipBuffers[0]
        : await combineHookClips({ clipBuffers, voiceover: null });
    const finalUpload = await uploadToR2({
      key: `hooks/${jobId}/final.mp4`,
      body: combined,
      contentType: "video/mp4",
    });

    await prisma.hookJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        assembleNotes: assembly as object,
        finalVideoUrl: finalUpload.url,
        finalVideoKey: finalUpload.key,
        progressDone: job.progressTotal || done + 1,
        completedAt: new Date(),
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hook job failed";
    await prisma.hookJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  }
}

async function processClipJob(jobId: string) {
  const job = await prisma.hookJob.findUnique({
    where: { id: jobId },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  if (!job) return;

  try {
    await prisma.hookJob.update({ where: { id: jobId }, data: { status: "animating" } });
    const scenes = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });
    if (!scenes.length) throw new Error("Clip job has no stills");

    let done = 0;
    for (const scene of scenes) {
      if (scene.clipUrl) {
        done += 1;
        await setProgress(jobId, done);
        continue;
      }
      if (!scene.startImageUrl) throw new Error(`Clip ${scene.sceneNumber} needs a start still`);
      await prisma.hookScene.update({ where: { id: scene.id }, data: { status: "animating" } });
      const clip = await generateSeedanceClip({
        prompt: scene.i2vPrompt || "",
        startImageUrl: scene.startImageUrl,
        endImageUrl: scene.endImageUrl,
      });
      const key = `clips/${jobId}/scene-${scene.sceneNumber}.mp4`;
      const uploaded = await uploadToR2({ key, body: clip, contentType: "video/mp4" });
      await prisma.hookScene.update({
        where: { id: scene.id },
        data: { clipUrl: uploaded.url, clipKey: uploaded.key, status: "done" },
      });
      done += 1;
      await setProgress(jobId, done);
    }

    const finished = await prisma.hookScene.findMany({
      where: { jobId },
      orderBy: { sceneNumber: "asc" },
    });
    const withClips = finished.filter((s) => s.clipUrl);
    if (!withClips.length) throw new Error("Seedance returned no clips");

    let finalUrl = withClips[0].clipUrl!;
    let finalKey = withClips[0].clipKey;
    if (withClips.length > 1) {
      await prisma.hookJob.update({ where: { id: jobId }, data: { status: "combining" } });
      const clipBuffers: Buffer[] = [];
      for (const scene of withClips) {
        const res = await fetch(scene.clipUrl!, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`Failed to fetch clip ${scene.sceneNumber}`);
        clipBuffers.push(Buffer.from(await res.arrayBuffer()));
      }
      const combined = await combineHookClips({ clipBuffers, voiceover: null });
      const uploaded = await uploadToR2({
        key: `clips/${jobId}/final.mp4`,
        body: combined,
        contentType: "video/mp4",
      });
      finalUrl = uploaded.url;
      finalKey = uploaded.key;
    }

    await prisma.hookJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        finalVideoUrl: finalUrl,
        finalVideoKey: finalKey,
        progressDone: job.progressTotal || done,
        completedAt: new Date(),
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clip job failed";
    await prisma.hookJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  }
}

export async function enqueueAllowed(): Promise<{ ok: boolean; used: number; cap: number }> {
  const used = await todayJobCount();
  const cap = maxHooksPerDay();
  return { ok: used < cap, used, cap };
}

export async function runHookWorkerLoop() {
  console.log("[hooks] worker loop started");
  while (true) {
    try {
      const next = await prisma.hookJob.findFirst({
        where: {
          status: { in: ["queued", "planning", "imaging", "analyzing", "animating", "voicing", "combining"] },
        },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        console.log(`[hooks] processing ${next.id} (${next.status})`);
        await processJob(next.id);
      } else {
        await sleep(2500);
      }
    } catch (error) {
      console.error("[hooks] worker tick failed", error);
      await sleep(4000);
    }
  }
}
