import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function getR2Config(): R2Config | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const bucket = process.env.R2_BUCKET || "";
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return { accessKeyId, secretAccessKey, bucket, endpoint };
}

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 is not configured");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return client;
}

export async function uploadToR2(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 is not configured");
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { key: input.key, url: `/api/media/${input.key}` };
}

export async function getFromR2(key: string): Promise<{
  body: Uint8Array;
  contentType: string;
} | null> {
  const cfg = getR2Config();
  if (!cfg) return null;
  try {
    const result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      body: bytes,
      contentType: result.ContentType || "image/png",
    };
  } catch {
    return null;
  }
}
