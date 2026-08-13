const BASE = "https://api.elevenlabs.io";

function elevenKey(): string {
  const key = process.env.ELEVENLABS_API_KEY || "";
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

async function elFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "xi-api-key": elevenKey(),
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
}

export async function createAndWaitForMedia(input: {
  kind: "image" | "video";
  body: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ url: string; mimeType: string }> {
  const create = await elFetch(`/v1/flows/${input.kind}`, {
    method: "POST",
    body: JSON.stringify(input.body),
  });
  const createdText = await create.text();
  if (!create.ok) {
    throw new Error(`ElevenLabs ${input.kind} create failed (${create.status}): ${createdText.slice(0, 240)}`);
  }
  const created = JSON.parse(createdText) as { id?: string };
  if (!created.id) throw new Error(`ElevenLabs ${input.kind} returned no generation id`);

  const deadline = Date.now() + (input.timeoutMs ?? 180_000);
  while (Date.now() < deadline) {
    const res = await elFetch(`/v1/flows/${input.kind}/${created.id}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`ElevenLabs ${input.kind} poll failed (${res.status}): ${text.slice(0, 240)}`);
    const data = JSON.parse(text) as {
      status?: string;
      content_url?: string;
      content_mime_type?: string;
      error_message?: string;
      failure_reason?: string;
    };
    if (data.status === "completed" && data.content_url) {
      return { url: data.content_url, mimeType: data.content_mime_type || "application/octet-stream" };
    }
    if (data.status === "failed") {
      throw new Error(data.error_message || data.failure_reason || `ElevenLabs ${input.kind} failed`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`ElevenLabs ${input.kind} timed out`);
}

export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Failed to download ElevenLabs media (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
