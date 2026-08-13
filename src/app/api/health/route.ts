export async function GET() {
  let egress: { country?: string; city?: string; region?: string; org?: string } | null = null;
  try {
    const res = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as { country?: string; city?: string; region?: string; org?: string };
      egress = { country: data.country, city: data.city, region: data.region, org: data.org };
    }
  } catch {
    egress = null;
  }
  return Response.json({
    ok: true,
    railwayRegion: process.env.RAILWAY_REPLICA_REGION || process.env.RAILWAY_REGION || null,
    egress,
  });
}
