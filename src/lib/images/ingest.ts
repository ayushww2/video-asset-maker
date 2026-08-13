import { uploadToR2 } from "@/lib/r2";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);

function sniffContentType(bytes: Buffer, fallback: string): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return fallback;
}

export async function ingestStill(input: {
  key: string;
  file?: File | null;
  url?: string | null;
}): Promise<{ url: string; key: string } | null> {
  const url = (input.url || "").trim();
  if (input.file && input.file.size > 0) {
    if (input.file.size > MAX_BYTES) throw new Error("Still is larger than 12MB");
    const type = (input.file.type || "").toLowerCase();
    if (type && !ALLOWED.has(type)) throw new Error("Stills must be PNG, JPEG, or WebP");
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const contentType = sniffContentType(bytes, type || "image/png");
    return uploadToR2({ key: input.key, body: bytes, contentType });
  }
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) throw new Error("Still URL must be http(s)");
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Could not fetch still (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error("Still is larger than 12MB");
  const headerType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentType = sniffContentType(bytes, ALLOWED.has(headerType) ? headerType : "image/png");
  return uploadToR2({ key: input.key, body: bytes, contentType });
}
