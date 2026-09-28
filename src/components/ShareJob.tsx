"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CopyShareLink from "@/components/CopyShareLink";
import { assetSrc, formatUsd, statusClass, type AssetRecord, type JobRecord } from "@/lib/ui";

export default function ShareJob({
  initialJob,
  initialAssets,
}: {
  initialJob: JobRecord;
  initialAssets: AssetRecord[];
}) {
  const [job, setJob] = useState(initialJob);
  const [assets, setAssets] = useState(initialAssets);

  useEffect(() => {
    if (!["queued", "planning", "generating"].includes(job.status)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${job.id}?images=1`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setJob(data.job);
        setAssets(data.assets || []);
        if (data.job.status === "completed" || data.job.status === "failed") return;
      } catch {
        /* ignore */
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    }
    timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job.id, job.status]);

  const withImages = assets.filter((asset) => assetSrc(asset)).length;
  const progress = job.progressTotal ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)]">
          Shared job
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{job.title}</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <CopyShareLink path={`/jobs/${job.id}`} />
          <Link href="/" className="btn btn-ghost">
            Open app
          </Link>
          <Link href={`/?job=${job.id}`} className="btn btn-ghost">
            Open in editor
          </Link>
        </div>
      </header>

      <section className="panel grid gap-3 p-5 md:grid-cols-3">
        <div>
          <p className="label">Status</p>
          <p className={`uppercase tracking-wider ${statusClass(job.status)}`}>{job.status}</p>
        </div>
        <div>
          <p className="label">Image gen cost</p>
          <p className="text-[var(--accent)]">{formatUsd(job.actualImageCostUsd)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {job.progressDone}/{job.progressTotal} assets · {withImages} with images
          </p>
        </div>
        <div>
          <p className="label">Total cost</p>
          <p>
            {formatUsd(job.actualTotalCostUsd)}{" "}
            <span className="text-xs text-[var(--muted)]">
              (reasoning {formatUsd(job.actualReasoningCostUsd)})
            </span>
          </p>
        </div>
      </section>

      {["planning", "generating", "queued"].includes(job.status) ? (
        <div className="panel space-y-2 p-4">
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--accent)]">
            Generating images… {progress}%
          </p>
          <div className="h-2 overflow-hidden bg-[#10130e]">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {job.error ? (
        <p className="border border-[var(--line)] bg-[#10130e] p-3 text-sm text-[var(--muted)]">{job.error}</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Assets</h2>
        {assets.length === 0 ? (
          <p className="text-[var(--muted)]">
            {job.status === "planning" || job.status === "queued"
              ? "Planning asset list…"
              : "No stored images on the server for this job. New jobs auto-save every generated still for share links."}
          </p>
        ) : (
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
                    </div>
                  )}
                  <span className="absolute left-2 top-2 bg-black/70 px-2 py-1 font-[family-name:var(--font-ibm-plex-mono)] text-[0.65rem] uppercase tracking-wider">
                    #{asset.assetNumber}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="font-medium">{asset.payload?.assetName || `Asset ${asset.assetNumber}`}</h3>
                  <p className="text-sm leading-snug text-[var(--muted)]">
                    {asset.payload?.scriptPlacement ||
                      (asset.payload?.scriptExcerpt
                        ? `Use when it says about ${asset.payload.scriptExcerpt}`
                        : null) ||
                      "Use when it says about this moment in the script"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
