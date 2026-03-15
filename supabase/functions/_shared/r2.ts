import { AwsClient } from "npm:aws4fetch";

let _r2: AwsClient | null = null;

export function getR2Client(): AwsClient {
  if (_r2) return _r2;
  _r2 = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  return _r2;
}

export function r2Url(key: string): string {
  const endpoint = Deno.env.get("R2_ENDPOINT")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;
  return `${endpoint}/${bucket}/${key}`;
}

export function r2PublicUrl(storagePath: string): string {
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")!;
  return `${publicUrl}/slideshow-images/${storagePath}`;
}

/**
 * Upload a file to R2.
 * @param key - Full object key (e.g. "slideshow-images/userId/collId/file.jpg")
 * @param body - File body (Uint8Array, ReadableStream, etc.)
 * @param contentType - MIME type
 */
export async function r2Upload(
  key: string,
  body: Uint8Array | ReadableStream<Uint8Array>,
  contentType: string,
): Promise<void> {
  const r2 = getR2Client();
  const res = await r2.fetch(r2Url(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }
}

/**
 * Delete one object from R2.
 * @param key - Full object key
 */
export async function r2Delete(key: string): Promise<void> {
  const r2 = getR2Client();
  const res = await r2.fetch(r2Url(key), { method: "DELETE" });
  // 204 = success, 404 = already gone — both are fine
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`R2 delete failed (${res.status}): ${text}`);
  }
}

/**
 * Delete multiple objects from R2. S3 DeleteObjects XML API.
 */
export async function r2DeleteMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // R2 supports the S3 multi-object delete API
  const r2 = getR2Client();
  const endpoint = Deno.env.get("R2_ENDPOINT")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;

  // Process in batches of 1000 (S3 limit)
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const xmlObjects = batch
      .map((k) => `<Object><Key>${escapeXml(k)}</Key></Object>`)
      .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${xmlObjects}</Delete>`;

    const res = await r2.fetch(`${endpoint}/${bucket}?delete`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/xml" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`R2 bulk delete failed (${res.status}): ${text}`);
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
