import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { estimateJob } from "@/lib/estimate";
import { serializeJob } from "@/lib/serialize";
import { getSessionFromCookies } from "@/lib/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfUtcDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function nextUtcDay(date: string) {
  const d = startOfUtcDay(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function GET(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dates = url.searchParams.get("dates");
  const recent = url.searchParams.get("recent");
  const date = url.searchParams.get("date");

  if (dates === "1") {
    const rows = await prisma.$queryRaw<Array<{ day: string }>>`
      SELECT DISTINCT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
      FROM jobs
      ORDER BY day DESC
      LIMIT 60
    `;
    return Response.json({ dates: rows.map((r) => r.day) });
  }

  if (recent === "1") {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return Response.json({ jobs: jobs.map(serializeJob) });
  }

  if (date) {
    if (!DATE_RE.test(date)) {
      return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: {
          gte: startOfUtcDay(date),
          lt: nextUtcDay(date),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ date, jobs: jobs.map(serializeJob) });
  }

  return Response.json(
    { error: "Query ?date=YYYY-MM-DD, ?dates=1, or ?recent=1 is required" },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    script?: string;
    guidance?: string;
    niche?: string;
    mood?: string;
    realFootage?: string;
    assetCount?: number;
    referenceNotes?: string;
    referenceImages?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });

  const assetCount = Math.min(25, Math.max(1, Number(body.assetCount || 22) || 22));
  const estimate = estimateJob({
    assetCount,
    referenceCount: Array.isArray(body.referenceImages) ? body.referenceImages.length : 0,
  });

  const job = await prisma.job.create({
    data: {
      title,
      script: body.script?.trim() || null,
      guidance: body.guidance?.trim() || null,
      niche: body.niche?.trim() || "mystery",
      mood: body.mood?.trim() || "investigative / suspenseful",
      realFootage: body.realFootage?.trim() || "LOW",
      assetCount,
      referenceNotes: body.referenceNotes?.trim() || null,
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : [],
      ownerUsername: user.username,
      status: "queued",
      estimate,
      progressDone: 0,
      progressTotal: assetCount,
    },
  });

  return Response.json({ estimate, job: serializeJob(job) });
}
