export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;

  try {
    const { runJobWorkerLoop } = await import("@/lib/jobs/process");
    const g = globalThis as unknown as { __videoAssetMakerJobWorker?: boolean };
    if (!g.__videoAssetMakerJobWorker) {
      g.__videoAssetMakerJobWorker = true;
      console.log("[jobs] instrumentation register — starting job worker loop");
      void runJobWorkerLoop().catch((error) => {
        console.error("[jobs] worker loop crashed", error);
      });
    }
  } catch (error) {
    console.error("[jobs] worker boot failed", error);
  }
}
