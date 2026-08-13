import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueAllowed } from "@/lib/jobs/process";
import { serializeJob } from "@/lib/serialize";
import { getSessionFromCookies } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind");
  const [jobs, capacity] = await Promise.all([
    prisma.hookJob.findMany({
      where: kind === "clip" || kind === "hook" ? { kind } : undefined,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { scenes: { orderBy: { sceneNumber: "asc" } } },
    }),
    enqueueAllowed(),
  ]);
  return Response.json({ jobs: jobs.map(serializeJob), capacity });
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const capacity = await enqueueAllowed();
  if (!capacity.ok) {
    return Response.json(
      { error: `Daily cap reached (${capacity.used}/${capacity.cap}). Sized for 20–30 hooks/day.` },
      { status: 429 },
    );
  }
  let body: { title?: string; script?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = (body.title || "").trim();
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
  const job = await prisma.hookJob.create({
    data: {
      title,
      script: body.script?.trim() || null,
      kind: "hook",
      ownerUsername: user.username,
      status: "queued",
      progressDone: 0,
      progressTotal: 15,
    },
    include: { scenes: true },
  });
  return Response.json({ job: serializeJob(job), capacity });
}
