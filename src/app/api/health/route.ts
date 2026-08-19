export async function GET() {
  let country: string | null = null;
  try {
    const res = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as { country?: string };
      country = data.country || null;
    }
  } catch {
    country = null;
  }
  return Response.json({
    ok: true,
    railwayRegion: process.env.RAILWAY_REPLICA_REGION || process.env.RAILWAY_REGION || null,
    egressCountry: country,
  });
}
