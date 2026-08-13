import OpenAI from "openai";
import { imageConfig } from "@/lib/env";

export async function generateGptImage(prompt: string): Promise<Buffer> {
  const cfg = imageConfig();
  if (!cfg.apiKey) throw new Error("IMAGE_API_KEY is not set");
  const openai = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    maxRetries: 0,
    timeout: 300_000,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const result = (await openai.images.generate({
        model: cfg.model,
        prompt,
        size: cfg.size as "1536x1024" | "1024x1024" | "1024x1536" | "auto",
        quality: cfg.quality,
      })) as {
        data?: Array<{ b64_json?: string | null; url?: string | null }>;
      };
      const first = result.data?.[0];
      if (!first) throw new Error("GPT Image returned no data");
      if (first.b64_json) return Buffer.from(first.b64_json, "base64");
      if (first.url) {
        const res = await fetch(first.url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`Failed to download image (${res.status})`);
        return Buffer.from(await res.arrayBuffer());
      }
      throw new Error("GPT Image missing b64_json and url");
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      if ((msg.includes("429") || msg.toLowerCase().includes("rate limit")) && attempt < 11) {
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("GPT Image failed");
}
