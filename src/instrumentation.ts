export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;
  try {
    const { runHookWorkerLoop } = await import("@/lib/jobs/process");
    const g = globalThis as unknown as { __vamHookWorker?: boolean };
    if (!g.__vamHookWorker) {
      g.__vamHookWorker = true;
      console.log("[hooks] starting worker");
      void runHookWorkerLoop().catch((error) => console.error("[hooks] worker crashed", error));
    }
  } catch (error) {
    console.error("[hooks] worker boot failed", error);
  }
}
