export function contactBoxBaseUrl(): string {
  const raw = (process.env.CONTACTBOX_BASE_URL || "https://api.contactboxtools.me").replace(/\/$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

export function contactBoxKey(): string {
  return process.env.CONTACTBOX_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function reasoningModel(): string {
  return process.env.REASONING_MODEL || "gpt-5.6-terra";
}

export function imageConfig() {
  const raw = (
    process.env.IMAGE_BASE_URL ||
    process.env.CONTACTBOX_BASE_URL ||
    "https://api.contactboxtools.me"
  ).replace(/\/$/, "");
  return {
    apiKey:
      process.env.IMAGE_API_KEY ||
      process.env.CONTACTBOX_API_KEY ||
      "",
    baseURL: raw.endsWith("/v1") ? raw : `${raw}/v1`,
    model: process.env.IMAGE_MODEL || "gpt-image-2",
    size: process.env.IMAGE_SIZE || "1536x1024",
    quality: (process.env.IMAGE_QUALITY || "low") as "low" | "medium" | "high" | "auto",
  };
}

export function maxHooksPerDay(): number {
  const n = Number(process.env.MAX_HOOKS_PER_DAY || 30);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 30;
}

export function r2PublicUrl(): string {
  return (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
}
