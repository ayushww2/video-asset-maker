export function getContactBoxApiKey(): string {
  return process.env.CONTACTBOX_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function getContactBoxBaseUrl(): string {
  const raw = (
    process.env.CONTACTBOX_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.contactboxtools.me"
  ).replace(/\/$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

export function getReasoningModel(): string {
  return (
    process.env.REASONING_MODEL ||
    process.env.CONTACTBOX_MODEL ||
    "gpt-5.6-terra"
  );
}

export function getReasoningTimeoutMs(): number {
  const n = Number(process.env.REASONING_TIMEOUT_MS || 600_000);
  if (!Number.isFinite(n) || n < 60_000) return 600_000;
  return Math.min(900_000, Math.round(n));
}

export function getPlannerScriptMaxChars(): number {
  const n = Number(process.env.PLANNER_SCRIPT_MAX_CHARS || 14_000);
  if (!Number.isFinite(n) || n < 2000) return 14_000;
  return Math.min(40_000, Math.round(n));
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

/** ElevenLabs credits per GPT Image 2 still (app default matches typical low 16:9 1K). */
export function getImageCreditsPerImage(): number {
  const n = Number(process.env.IMAGE_CREDITS_PER_IMAGE || 50);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 50;
}

/** USD value of one ElevenLabs credit when deriving image $ from credits. */
export function getImageCreditUsd(): number {
  const n = Number(process.env.IMAGE_CREDIT_USD || 0.001);
  return Number.isFinite(n) && n >= 0 ? n : 0.001;
}

export function getImageCostUsd(): number {
  const explicit = process.env.IMAGE_COST_USD?.trim();
  if (explicit) {
    const n = Number(explicit);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return getImageCreditsPerImage() * getImageCreditUsd();
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

export function isAuthEnabled(): boolean {
  const disable = (process.env.DISABLE_AUTH || "").trim().toLowerCase();
  if (disable === "1" || disable === "true" || disable === "yes") return false;
  const required = (process.env.AUTH_REQUIRED ?? "true").trim().toLowerCase();
  return required !== "false" && required !== "0";
}

export function useElevenLabsImage(): boolean {
  return Boolean((process.env.ELEVENLABS_API_KEY || "").trim());
}
