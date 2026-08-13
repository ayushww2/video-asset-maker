export function getContactBoxApiKey(): string {
  return process.env.CONTACTBOX_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function getContactBoxBaseUrl(): string {
  return (
    process.env.CONTACTBOX_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.contactboxtools.me"
  ).replace(/\/$/, "");
}

export function getReasoningModel(): string {
  return (
    process.env.REASONING_MODEL ||
    process.env.CONTACTBOX_MODEL ||
    "gpt-5.6-terra"
  );
}

export function getOpenAiImageConfig() {
  const rawBase = (
    process.env.IMAGE_BASE_URL ||
    process.env.OPENAI_IMAGE_BASE_URL ||
    "https://api.openai.com"
  ).replace(/\/$/, "");
  const baseURL = rawBase.endsWith("/v1") ? rawBase : `${rawBase}/v1`;

  return {
    apiKey:
      process.env.IMAGE_API_KEY ||
      process.env.OPENAI_IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseURL,
    model: process.env.IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    size: process.env.IMAGE_SIZE || process.env.OPENAI_IMAGE_SIZE || "1536x1024",
    quality: (process.env.IMAGE_QUALITY ||
      process.env.OPENAI_IMAGE_QUALITY ||
      "low") as "low" | "medium" | "high" | "auto",
  };
}

export function getImageConcurrency(): number {
  const n = Number(process.env.IMAGE_CONCURRENCY || 5);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(10, Math.round(n));
}

export function getImageCostUsd(): number {
  const n = Number(process.env.IMAGE_COST_USD || 0.006);
  return Number.isFinite(n) && n >= 0 ? n : 0.006;
}

export function getImageSecondsAvg(): number {
  const n = Number(process.env.IMAGE_SECONDS_AVG || 22);
  return Number.isFinite(n) && n > 0 ? n : 22;
}

export function getReasoningCostUsd(): number {
  const n = Number(process.env.REASONING_COST_USD_ESTIMATE || 0.04);
  return Number.isFinite(n) && n >= 0 ? n : 0.04;
}

export function getReasoningSecondsAvg(): number {
  const n = Number(process.env.REASONING_SECONDS_AVG || 55);
  return Number.isFinite(n) && n > 0 ? n : 55;
}
