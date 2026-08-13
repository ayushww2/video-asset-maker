import type { HookJob, HookScene } from "@prisma/client";
import type { HookPlan } from "@/lib/jobs/planner";

export function serializeJob(job: HookJob & { scenes?: HookScene[] }) {
  return {
    id: job.id,
    title: job.title,
    script: job.script,
    ownerUsername: job.ownerUsername,
    status: job.status,
    sceneCount: job.sceneCount,
    plan: job.plan as HookPlan | null,
    voiceoverText: job.voiceoverText,
    voiceoverLanguage: job.voiceoverLanguage,
    voiceoverUrl: job.voiceoverUrl,
    assembleNotes: job.assembleNotes,
    finalVideoUrl: job.finalVideoUrl,
    error: job.error,
    progressDone: job.progressDone,
    progressTotal: job.progressTotal,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    scenes: (job.scenes || []).map(serializeScene),
  };
}

export function serializeScene(scene: HookScene) {
  return {
    id: scene.id,
    sceneNumber: scene.sceneNumber,
    purpose: scene.purpose,
    durationSec: scene.durationSec,
    whatViewerSees: scene.whatViewerSees,
    curiosity: scene.curiosity,
    startPrompt: scene.startPrompt,
    endPrompt: scene.endPrompt,
    i2vPrompt: scene.i2vPrompt,
    startImageUrl: scene.startImageUrl,
    endImageUrl: scene.endImageUrl,
    clipUrl: scene.clipUrl,
    frameAnalysis: scene.frameAnalysis,
    status: scene.status,
    error: scene.error,
  };
}
