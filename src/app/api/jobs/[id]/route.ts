import { prisma } from "@/lib/db";
import { serializeJob } from "@/lib/serialize";
import { getSessionFromCookies } from "@/lib/session";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionFromCookies();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const job = await prisma.hookJob.findUnique({
    where: { id },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json({ job: serializeJob(job) });
}
