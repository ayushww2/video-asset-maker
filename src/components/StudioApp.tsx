"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "hooks" | "clips";

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
  kind?: string;
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
  const [mode, setMode] = useState<Mode>("hooks");
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)]">
          18-second clip factory
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Always 18 seconds</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Backend always makes 3 scenes, 2 frames each, converts each pair to one 6s clip, then assembles a silent 18s
          piece. GPT Image 2 stills → Seedance 2.5 clips → silent assemble. Not ElevenLabs.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
          <span>
            Today {capacity?.used ?? "—"}/{capacity?.cap ?? 30}
          </span>
          <button className="btn btn-ghost" type="button" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/login"))}>
            Log out
          </button>
        </div>
        <div className="mt-6 flex gap-2">
          <button className={mode === "hooks" ? "btn" : "btn btn-ghost"} type="button" onClick={() => { setMode("hooks"); setError(null); }}>
            18s factory
          </button>
          <button className={mode === "clips" ? "btn" : "btn btn-ghost"} type="button" onClick={() => { setMode("clips"); setError(null); }}>
            Stills in
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {mode === "clips" ? (
        <ClipsSection onCapacity={setCapacity} onError={setError} />
      ) : (
        <HooksSection onCapacity={setCapacity} onError={setError} />
      )}
    </div>
  );
}

type ClipSceneDraft = {
  prompt: string;
  startFile: File | null;
  endFile: File | null;
  startUrl: string;
  endUrl: string;
};

function emptyClipScenes(): ClipSceneDraft[] {
  return [1, 2, 3].map(() => ({ prompt: "", startFile: null, endFile: null, startUrl: "", endUrl: "" }));
}

function ClipsSection({
  onCapacity,
  onError,
}: {
  onCapacity: (c: Capacity) => void;
  onError: (e: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<ClipSceneDraft[]>(emptyClipScenes);
  const [job, setJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const progress = useMemo(() => {
    if (!job?.progressTotal) return 0;
    return Math.round((job.progressDone / job.progressTotal) * 100);
  }, [job]);

  function patchScene(index: number, patch: Partial<ClipSceneDraft>) {
    setScenes((prev) => prev.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)));
  }

  async function refreshList() {
    const res = await fetch("/api/jobs?kind=clip");
    const data = await res.json();
    if (res.ok) {
      setJobs(data.jobs || []);
      if (data.capacity) onCapacity(data.capacity);
    }
  }

  async function submit() {
    onError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("title", title.trim() || "18s clip");
      scenes.forEach((scene, i) => {
        const n = i + 1;
        form.set(`prompt${n}`, scene.prompt.trim());
        if (scene.startFile) form.set(`start${n}`, scene.startFile);
        if (scene.endFile) form.set(`end${n}`, scene.endFile);
        if (scene.startUrl.trim()) form.set(`startUrl${n}`, scene.startUrl.trim());
        if (scene.endUrl.trim()) form.set(`endUrl${n}`, scene.endUrl.trim());
      });
      const res = await fetch("/api/clips", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clip submit failed");
      setJob(data.job);
      if (data.capacity) onCapacity(data.capacity);
      void refreshList();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Clip submit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshList();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useJobPoll(job, setJob, refreshList);

  const canSubmit = scenes.every((scene) => {
    const start = scene.startFile || scene.startUrl.trim();
    const end = scene.endFile || scene.endUrl.trim();
    return Boolean(scene.prompt.trim() && start && end && !busy);
  });

  return (
    <>
      <section className="panel space-y-4 p-5">
        <div>
          <h2 className="text-2xl font-semibold">18s from existing stills</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Three scenes, start + end still each. Seedance 2.5 makes three 6s clips, then one silent 18s assemble. No
            GPT Image.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="clip-title">
            Label (optional)
          </label>
          <input id="clip-title" className="field" placeholder="Nile ROV hook" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {scenes.map((scene, index) => (
          <article key={index} className="space-y-3 border-t border-[var(--line)] pt-4">
            <h3 className="text-lg font-medium">Scene {index + 1}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <StillPicker
                id={`start-${index + 1}`}
                label="Start still"
                file={scene.startFile}
                url={scene.startUrl}
                preview={scene.startFile ? URL.createObjectURL(scene.startFile) : scene.startUrl || null}
                onFile={(file) => patchScene(index, { startFile: file })}
                onUrl={(url) => patchScene(index, { startUrl: url })}
              />
              <StillPicker
                id={`end-${index + 1}`}
                label="End still"
                file={scene.endFile}
                url={scene.endUrl}
                preview={scene.endFile ? URL.createObjectURL(scene.endFile) : scene.endUrl || null}
                onFile={(file) => patchScene(index, { endFile: file })}
                onUrl={(url) => patchScene(index, { endUrl: url })}
              />
            </div>
            <div>
              <label className="label" htmlFor={`clip-prompt-${index + 1}`}>
                Motion prompt
              </label>
              <textarea
                id={`clip-prompt-${index + 1}`}
                className="field min-h-24 resize-y"
                placeholder="Slow handheld drift toward the end frame…"
                value={scene.prompt}
                onChange={(e) => patchScene(index, { prompt: e.target.value })}
              />
            </div>
          </article>
        ))}
        <button className="btn" type="button" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? "Queueing…" : "Make 18s clip"}
        </button>
      </section>

      {job ? <JobResult job={job} progress={progress} /> : null}
      {job?.scenes?.length ? <SceneGrid scenes={job.scenes} /> : null}

      {jobs.length > 0 ? <RecentJobs jobs={jobs} onSelect={setJob} /> : null}
    </>
  );
}

function HooksSection({
  onCapacity,
  onError,
}: {
  onCapacity: (c: Capacity) => void;
  onError: (e: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const progress = useMemo(() => {
    if (!job?.progressTotal) return 0;
    return Math.round((job.progressDone / job.progressTotal) * 100);
  }, [job]);

  async function refreshList() {
    const res = await fetch("/api/jobs?kind=hook");
    const data = await res.json();
    if (res.ok) {
      setJobs(data.jobs || []);
      if (data.capacity) onCapacity(data.capacity);
    }
  }

  async function submit() {
    onError(null);
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
      if (data.capacity) onCapacity(data.capacity);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshList();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useJobPoll(job, setJob, refreshList);

  return (
    <>
      <section className="panel space-y-4 p-5">
        <div>
          <h2 className="text-2xl font-semibold">18s factory</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Title in. Backend always plans 3 scenes, GPT Image 2 makes start + end for each, Seedance 2.5 turns each
            pair into a 6s clip, then silent assemble to 18s. No voiceover. Not ElevenLabs.
          </p>
        </div>
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
          {busy ? "Queueing…" : "Generate 18s clip"}
        </button>
      </section>

      {job ? <JobResult job={job} progress={progress} /> : null}

      {job?.scenes?.length ? <SceneGrid scenes={job.scenes} /> : null}

      {jobs.length > 0 ? <RecentJobs jobs={jobs} onSelect={setJob} /> : null}
    </>
  );
}

function StillPicker({
  id,
  label,
  file,
  url,
  preview,
  onFile,
  onUrl,
}: {
  id: string;
  label: string;
  file: File | null;
  url: string;
  preview: string | null;
  onFile: (file: File | null) => void;
  onUrl: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="label">{label}</p>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="aspect-video w-full object-cover" />
      ) : (
        <div className="aspect-video border border-dashed border-[var(--line)] bg-black/40" />
      )}
      <input
        id={`${id}-file`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="block w-full text-sm text-[var(--muted)]"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      <input
        id={`${id}-url`}
        className="field"
        placeholder="or paste a still URL"
        value={file ? "" : url}
        disabled={Boolean(file)}
        onChange={(e) => onUrl(e.target.value)}
      />
    </div>
  );
}

function JobResult({ job, progress }: { job: Job; progress: number }) {
  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{job.title}</h2>
          <p className="mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--accent)]">
            {job.status} · 3 scenes · 18s
          </p>
        </div>
        {job.finalVideoUrl ? (
          <a className="btn" href={job.finalVideoUrl} target="_blank" rel="noreferrer">
            Download 18s
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
      {job.scenes[0]?.i2vPrompt ? (
        <p className="text-sm text-[var(--muted)]">{job.scenes[0].i2vPrompt}</p>
      ) : null}
      {job.finalVideoUrl || job.scenes[0]?.clipUrl ? (
        <video className="w-full border border-[var(--line)]" controls src={job.finalVideoUrl || job.scenes[0]?.clipUrl || undefined} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {job.scenes[0]?.startImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.scenes[0].startImageUrl} alt="Start still" className="aspect-video w-full object-cover" />
          ) : null}
          {job.scenes[0]?.endImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.scenes[0].endImageUrl} alt="End still" className="aspect-video w-full object-cover" />
          ) : null}
        </div>
      )}
    </section>
  );
}

function SceneGrid({ scenes }: { scenes: Scene[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Scenes</h2>
      {scenes.map((scene) => (
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
  );
}

function RecentJobs({ jobs, onSelect }: { jobs: Job[]; onSelect: (job: Job) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Recent</h2>
      {jobs.map((item) => (
        <button key={item.id} type="button" className="panel flex w-full items-center justify-between p-4 text-left" onClick={() => onSelect(item)}>
          <span>{item.title}</span>
          <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
            {item.status}
          </span>
        </button>
      ))}
    </section>
  );
}

function useJobPoll(job: Job | null, setJob: (job: Job) => void, refreshList: () => void) {
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
}
