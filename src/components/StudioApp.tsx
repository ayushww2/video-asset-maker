"use client";

import { useEffect, useMemo, useState } from "react";

type Scene = {
  id: string;
  sceneNumber: number;
  purpose: string | null;
  whatViewerSees: string | null;
  curiosity: string | null;
  startImageUrl: string | null;
  endImageUrl: string | null;
  clipUrl: string | null;
  i2vPrompt: string | null;
  status: string;
};

type Job = {
  id: string;
  title: string;
  script: string | null;
  status: string;
  sceneCount: number;
  plan: {
    whyThisStructure?: string;
    evidenceStyle?: string;
    voiceover?: { language?: string; languageWhy?: string; lines?: string[] };
    editNotes?: { clipOrder?: number[]; soundDesign?: string; overlayText?: string[]; finalTiming?: string };
  } | null;
  voiceoverText: string | null;
  voiceoverLanguage: string | null;
  voiceoverUrl: string | null;
  assembleNotes: { clipOrder?: number[]; reason?: string; soundDesign?: string; overlayText?: string[] } | null;
  finalVideoUrl: string | null;
  error: string | null;
  progressDone: number;
  progressTotal: number;
  createdAt: string;
  scenes: Scene[];
};

type Capacity = { ok: boolean; used: number; cap: number };

export default function StudioApp() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const progress = useMemo(() => {
    if (!job?.progressTotal) return 0;
    return Math.round((job.progressDone / job.progressTotal) * 100);
  }, [job]);

  async function refreshList() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    if (res.ok) {
      setJobs(data.jobs || []);
      setCapacity(data.capacity || null);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setJob(data.job);
      setCapacity(data.capacity || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshList();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!job || ["completed", "failed"].includes(job.status)) return;
    const jobId = job.id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      if (cancelled || !res.ok) return;
      setJob(data.job);
      if (["completed", "failed"].includes(data.job.status)) {
        void refreshList();
        return;
      }
      timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll on job id/status only
  }, [job?.id, job?.status]);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)]">
          Mystery hook factory
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Video Asset Maker</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Title in. Recovered start/end frames, Seedance 6s clips, then one 18-second assembled hook.
          Sized for 20–30 jobs a day.
        </p>
        <div className="mt-4 flex items-center gap-3 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
          <span>
            Today {capacity?.used ?? "—"}/{capacity?.cap ?? 30}
          </span>
          <button className="btn btn-ghost" type="button" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/login"))}>
            Log out
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <section className="panel space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="field"
            placeholder="They Found Something Under the Nile That Shouldn't Exist"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="script">
            Script / topic (optional)
          </label>
          <textarea
            id="script"
            className="field min-h-32 resize-y"
            placeholder="Paste hook script or topic notes…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
        </div>
        <button className="btn" type="button" disabled={!title.trim() || busy} onClick={() => void submit()}>
          {busy ? "Queueing…" : "Generate 18s hook"}
        </button>
      </section>

      {job ? (
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">{job.title}</h2>
              <p className="mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--accent)]">
                {job.status} · {job.sceneCount} scenes
              </p>
            </div>
            {job.finalVideoUrl ? (
              <a className="btn" href={job.finalVideoUrl} target="_blank" rel="noreferrer">
                Download final
              </a>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden bg-[#10130e]">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
          </div>
          {job.error ? <p className="text-sm text-[var(--danger)]">{job.error}</p> : null}
          {job.plan ? (
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="label">Evidence style</span>
                {job.plan.evidenceStyle}
              </p>
              <p>
                <span className="label">Why this structure</span>
                {job.plan.whyThisStructure}
              </p>
            </div>
          ) : null}
          {job.voiceoverText ? (
            <div>
              <p className="label">Voiceover ({job.voiceoverLanguage || "English"})</p>
              <p className="text-sm text-[var(--muted)]">{job.voiceoverText}</p>
              {job.voiceoverUrl ? (
                <audio className="mt-2 w-full" controls src={job.voiceoverUrl} />
              ) : null}
            </div>
          ) : null}
          {job.assembleNotes ? (
            <p className="text-sm text-[var(--muted)]">
              Assemble order: {(job.assembleNotes.clipOrder || []).join(" → ")} · {job.assembleNotes.reason}
            </p>
          ) : null}
          {job.finalVideoUrl ? (
            <video className="w-full border border-[var(--line)]" controls src={job.finalVideoUrl} />
          ) : null}
        </section>
      ) : null}

      {job?.scenes?.length ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Scenes</h2>
          {job.scenes.map((scene) => (
            <article key={scene.id || scene.sceneNumber} className="panel space-y-3 p-4">
              <h3 className="text-lg font-medium">
                Scene {scene.sceneNumber} · {scene.purpose}
              </h3>
              <p className="text-sm text-[var(--muted)]">{scene.whatViewerSees}</p>
              <p className="text-sm">{scene.curiosity}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="label">Start frame</p>
                  {scene.startImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.startImageUrl} alt={`Scene ${scene.sceneNumber} start`} className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="aspect-video bg-black/40" />
                  )}
                </div>
                <div>
                  <p className="label">End frame</p>
                  {scene.endImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.endImageUrl} alt={`Scene ${scene.sceneNumber} end`} className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="aspect-video bg-black/40" />
                  )}
                </div>
              </div>
              {scene.clipUrl ? <video className="w-full" controls src={scene.clipUrl} /> : null}
            </article>
          ))}
        </section>
      ) : null}

      {jobs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Recent</h2>
          {jobs.map((item) => (
            <button
              key={item.id}
              type="button"
              className="panel flex w-full items-center justify-between p-4 text-left"
              onClick={() => setJob(item)}
            >
              <span>{item.title}</span>
              <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
                {item.status}
              </span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
