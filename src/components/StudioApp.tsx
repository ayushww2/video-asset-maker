"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CopyShareLink from "@/components/CopyShareLink";
import {
  DEFAULT_GUIDANCE,
  NICHES,
  assetSrc,
  formatSeconds,
  formatUsd,
  statusClass,
  type AssetRecord,
  type JobRecord,
} from "@/lib/ui";

type Tab = "new" | "history";
type ReferenceImage = { name: string; mimeType: string; dataUrl: string };
type Estimate = NonNullable<JobRecord["estimate"]>;
type SessionUser = { username: string; displayName: string };

async function fileToRef(file: File): Promise<ReferenceImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type || "image/png", dataUrl };
}

function todayUtc(): string {
  const e = new Date();
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}

function downloadAsset(asset: AssetRecord) {
  const src = assetSrc(asset);
  if (!src) return;
  const a = document.createElement("a");
  a.href = src;
  a.target = "_blank";
  a.rel = "noreferrer";
  const name = asset.payload?.assetName || `asset-${asset.assetNumber}`;
  a.download = `${String(asset.assetNumber).padStart(2, "0")}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48)}.png`;
  a.click();
}

export default function StudioApp() {
  const searchParams = useSearchParams();
  const jobFromUrl = searchParams.get("job");
  const [tab, setTab] = useState<Tab>("new");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [guidance, setGuidance] = useState(DEFAULT_GUIDANCE);
  const [niche, setNiche] = useState("mystery");
  const [mood, setMood] = useState("investigative / suspenseful");
  const [realFootage, setRealFootage] = useState("LOW");
  const [assetCount, setAssetCount] = useState(22);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [referenceNotes, setReferenceNotes] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(jobFromUrl);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState(todayUtc);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [historyJobs, setHistoryJobs] = useState<JobRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const progress = useMemo(
    () => (job?.progressTotal ? Math.round((job.progressDone / job.progressTotal) * 100) : 0),
    [job],
  );

  async function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const next = await Promise.all([...files].map(fileToRef));
    setReferences((current) => [...current, ...next].slice(0, 8));
  }

  async function onPaste(event: React.ClipboardEvent) {
    const items = [...event.clipboardData.items].filter((item) => item.type.startsWith("image/"));
    if (!items.length) return;
    event.preventDefault();
    const files = items.map((item) => item.getAsFile()).filter((file): file is File => !!file);
    const next = await Promise.all(files.map(fileToRef));
    setReferences((current) => [...current, ...next].slice(0, 8));
  }

  async function submitJob() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          script,
          guidance,
          niche,
          mood,
          realFootage,
          assetCount,
          referenceNotes,
          referenceImages: references,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setEstimate(data.estimate);
      setJob(data.job);
      setActiveJobId(data.job.id);
      setAssets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function openJob(id: string) {
    setError(null);
    setTab("new");
    setActiveJobId(id);
    const res = await fetch(`/api/jobs/${id}?images=1`);
    const data = await res.json();
    if (res.ok) {
      setJob(data.job);
      setAssets(data.assets || []);
      setTitle(data.job.title || "");
    } else {
      setError(data.error || "Failed to open job");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetCount, referenceCount: references.length }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) setEstimate(data.estimate);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetCount, references.length]);

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${activeJobId}?images=1`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Poll failed");
        setJob(data.job);
        setAssets(data.assets || []);
        setTitle(data.job.title || "");
        if (data.job.status === "completed" || data.job.status === "failed") return;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Poll failed");
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeJobId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const [datesRes, dateRes, recentRes] = await Promise.all([
          fetch("/api/jobs?dates=1"),
          fetch(`/api/jobs?date=${historyDate}`),
          fetch("/api/jobs?recent=1"),
        ]);
        const datesData = await datesRes.json();
        const dateData = await dateRes.json();
        const recentData = await recentRes.json();
        if (cancelled) return;
        if (datesRes.ok) setHistoryDates(datesData.dates || []);
        if (!dateRes.ok) throw new Error(dateData.error || "Failed to load jobs");
        const listed = dateData.jobs || [];
        const recent = recentData.jobs || [];
        setHistoryJobs(listed.length ? listed : recent);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "History failed");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, historyDate]);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)]">
          Documentary pipeline
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Video Asset Maker</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Submit a title/script job. Backend plans assets, then generates up to 10 images at a time.
          Estimates cover reasoning + image cost/time.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className={`btn ${tab === "new" ? "" : "btn-ghost"}`} onClick={() => setTab("new")}>
            New job
          </button>
          <button
            type="button"
            className={`btn ${tab === "history" ? "" : "btn-ghost"}`}
            onClick={() => setTab("history")}
          >
            Past jobs
          </button>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
                {user.displayName}
              </span>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <p className="border border-[var(--danger)] bg-[#2a1818] px-3 py-2 text-sm text-[#f0c0c0]">{error}</p>
      ) : null}

      {tab === "history" ? (
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label" htmlFor="historyDate">
                View by date
              </label>
              <input
                id="historyDate"
                type="date"
                className="field"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
              />
            </div>
            {historyDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {historyDates.slice(0, 8).map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`btn btn-ghost ${day === historyDate ? "!border-[var(--accent)]" : ""}`}
                    onClick={() => setHistoryDate(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {historyLoading ? (
            <p className="text-[var(--muted)]">Loading jobs…</p>
          ) : historyJobs.length === 0 ? (
            <p className="text-[var(--muted)]">No jobs on this date.</p>
          ) : (
            <div className="space-y-3">
              {historyJobs.map((item) => (
                <div key={item.id} className="panel flex w-full flex-col gap-3 p-4">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 text-left hover:opacity-90"
                    onClick={() => void openJob(item.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-medium">{item.title}</h3>
                      <span
                        className={`font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider ${statusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)]">
                      <span>
                        {new Date(item.createdAt).toLocaleString()} · {item.progressDone}/{item.progressTotal} images
                      </span>
                      <span>image gen {formatUsd(item.actualImageCostUsd)}</span>
                      <span>total {formatUsd(item.actualTotalCostUsd)}</span>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <CopyShareLink path={`/jobs/${item.id}`} />
                    <Link href={`/jobs/${item.id}`} className="btn btn-ghost">
                      Open share page
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="panel space-y-4 p-5">
              <div>
                <label className="label" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  className="field"
                  placeholder="e.g. They Found Something Under the Nile That Shouldn't Exist"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="script">
                  Script (optional)
                </label>
                <textarea
                  id="script"
                  className="field min-h-40 resize-y"
                  placeholder="Paste hook / first 60–90 seconds or full script…"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="niche">
                    Niche
                  </label>
                  <select id="niche" className="field" value={niche} onChange={(e) => setNiche(e.target.value)}>
                    {NICHES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="mood">
                    Mood
                  </label>
                  <input id="mood" className="field" value={mood} onChange={(e) => setMood(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="footage">
                    Real footage
                  </label>
                  <select
                    id="footage"
                    className="field"
                    value={realFootage}
                    onChange={(e) => setRealFootage(e.target.value)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="count">
                  Asset count (1–25)
                </label>
                <input
                  id="count"
                  type="number"
                  min={1}
                  max={25}
                  className="field"
                  value={assetCount}
                  onChange={(e) => setAssetCount(Math.min(25, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <label className="label" htmlFor="guidance">
                  Guidance
                </label>
                <textarea
                  id="guidance"
                  className="field min-h-28 resize-y"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  onPaste={onPaste}
                />
              </div>
            </section>

            <section className="panel space-y-4 p-5">
              <div>
                <label className="label">Reference images — paste or upload (max 8)</label>
                <div
                  className="field flex min-h-28 flex-col items-center justify-center border-dashed text-center text-[var(--muted)]"
                  onPaste={onPaste}
                >
                  <p className="mb-3 text-sm">Ctrl+V images here. Style dialogue is matched, scenes are not repeated.</p>
                  <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
                </div>
              </div>
              {references.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {references.map((ref, index) => (
                    <button
                      key={`${ref.name}-${index}`}
                      type="button"
                      className="group relative overflow-hidden border border-[var(--line)]"
                      onClick={() => setReferences((current) => current.filter((_, i) => i !== index))}
                      title="Remove"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ref.dataUrl} alt={ref.name} className="aspect-video w-full object-cover opacity-90" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div>
                <label className="label" htmlFor="refnotes">
                  Reference notes
                </label>
                <textarea
                  id="refnotes"
                  className="field min-h-20 resize-y"
                  value={referenceNotes}
                  onChange={(e) => setReferenceNotes(e.target.value)}
                />
              </div>
              {estimate ? (
                <div className="border border-[var(--line)] bg-[#10130e] p-4">
                  <p className="label">Pre-submit estimate</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[var(--muted)]">Reasoning</p>
                      <p>
                        {formatUsd(estimate.reasoningCostUsd)} · {formatSeconds(estimate.reasoningSeconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">
                        Images ({estimate.assetCount} @ {estimate.imageConcurrency} concurrent)
                      </p>
                      <p>
                        {formatUsd(estimate.imageCostUsd)} · {formatSeconds(estimate.imageSeconds)}
                      </p>
                    </div>
                    <div className="col-span-2 border-t border-[var(--line)] pt-3">
                      <p className="text-[var(--muted)]">Total</p>
                      <p className="text-lg text-[var(--accent)]">
                        {formatUsd(estimate.totalCostUsd)} · ~{formatSeconds(estimate.totalSeconds)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{estimate.breakdown}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="btn w-full"
                disabled={!title.trim() || submitting}
                onClick={() => void submitJob()}
              >
                {submitting
                  ? "Submitting…"
                  : `Submit job${estimate ? ` · ~${formatUsd(estimate.totalCostUsd)} / ${formatSeconds(estimate.totalSeconds)}` : ""}`}
              </button>
            </section>
          </div>

          {job ? (
            <section className="panel space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{job.title}</h2>
                  <p
                    className={`mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider ${statusClass(job.status)}`}
                  >
                    {job.status}
                    {job.status === "generating" || job.status === "planning" ? " · backend worker active" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyShareLink path={`/jobs/${job.id}`} />
                  <Link href={`/jobs/${job.id}`} className="btn btn-ghost">
                    Share page
                  </Link>
                </div>
              </div>
              <div className="h-2 overflow-hidden bg-[#10130e]">
                <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)]">
                Progress {job.progressDone}/{job.progressTotal} · {progress}%
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="border border-[var(--line)] p-3 text-sm">
                  <p className="label">Estimate</p>
                  <p>
                    {formatUsd(job.estimate?.totalCostUsd)} · {formatSeconds(job.estimate?.totalSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    reasoning {formatUsd(job.estimate?.reasoningCostUsd)} + images {formatUsd(job.estimate?.imageCostUsd)}
                  </p>
                </div>
                <div className="border border-[var(--line)] p-3 text-sm">
                  <p className="label">Actual so far</p>
                  <p>
                    {formatUsd(job.actualTotalCostUsd)} ·{" "}
                    {job.actualReasoningMs != null
                      ? formatSeconds(((job.actualReasoningMs || 0) + (job.actualImageMs || 0)) / 1000)
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    reasoning {formatUsd(job.actualReasoningCostUsd)}
                    {job.actualReasoningTokens ? ` (${job.actualReasoningTokens} tok)` : ""} + images{" "}
                    {formatUsd(job.actualImageCostUsd)}
                  </p>
                </div>
                <div className="border border-[var(--line)] p-3 text-sm">
                  <p className="label">Queue</p>
                  <p>Max {job.estimate?.imageConcurrency ?? 5} images at a time</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {job.estimate?.imageBatches ?? "—"} image batches estimated
                  </p>
                </div>
              </div>
              {job.error ? <p className="text-sm text-[var(--danger)]">{job.error}</p> : null}
              {job.plan?.diagnosis?.titlePromise ? (
                <p className="text-sm text-[var(--muted)]">{job.plan.diagnosis.titlePromise}</p>
              ) : null}
            </section>
          ) : null}

          {assets.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Generated assets</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => (
                  <article key={asset.id} className="panel flex flex-col overflow-hidden">
                    <div className="relative aspect-video bg-black">
                      {assetSrc(asset) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetSrc(asset) || ""}
                          alt={asset.payload?.assetName || "asset"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-center font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]">
                          {asset.status}
                          {asset.error ? ` · ${asset.error}` : ""}
                        </div>
                      )}
                      <span className="absolute left-2 top-2 bg-black/70 px-2 py-1 font-[family-name:var(--font-ibm-plex-mono)] text-[0.65rem] uppercase tracking-wider">
                        #{asset.assetNumber} · {asset.status}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <h3 className="font-medium leading-snug">
                        {asset.payload?.assetName || `Asset ${asset.assetNumber}`}
                      </h3>
                      <p className="text-sm leading-snug text-[var(--muted)]">
                        {asset.payload?.scriptPlacement ||
                          (asset.payload?.scriptExcerpt
                            ? `Use when it says about ${asset.payload.scriptExcerpt}`
                            : null) ||
                          "Use when it says about this moment in the script"}
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost mt-auto"
                        disabled={!assetSrc(asset)}
                        onClick={() => downloadAsset(asset)}
                      >
                        Download
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
