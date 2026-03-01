import { createClient } from "@/lib/supabase/client";

// In-memory signed URL cache (50 min TTL, URLs expire at 60 min)
const cache = new Map<string, { url: string; expiry: number }>();
const CACHE_TTL = 50 * 60 * 1000;

/** Generate a signed URL for a private storage path (cached) */
export async function getSignedImageUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const key = `${bucket}:${path}`;
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.url;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return "/placeholder-product.svg";
    const url = data.signedUrl;
    cache.set(key, { url, expiry: Date.now() + CACHE_TTL });
    return url;
  } catch {
    return "/placeholder-product.svg";
  }
}

/** Batch signed URLs (cached individually) */
export async function getSignedImageUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<string[]> {
  if (paths.length === 0) return [];

  // Check cache for each path; collect uncached ones
  const results: (string | null)[] = paths.map(() => null);
  const uncachedIndices: number[] = [];
  const uncachedPaths: string[] = [];

  for (let i = 0; i < paths.length; i++) {
    const key = `${bucket}:${paths[i]}`;
    const cached = cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      results[i] = cached.url;
    } else {
      uncachedIndices.push(i);
      uncachedPaths.push(paths[i]);
    }
  }

  // Batch fetch uncached URLs
  if (uncachedPaths.length > 0) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(uncachedPaths, expiresIn);

    if (!error && data) {
      for (let j = 0; j < data.length; j++) {
        const url = data[j].signedUrl || "/placeholder-product.svg";
        const originalIndex = uncachedIndices[j];
        results[originalIndex] = url;
        const key = `${bucket}:${uncachedPaths[j]}`;
        cache.set(key, { url, expiry: Date.now() + CACHE_TTL });
      }
    } else {
      // Fill failures with placeholder
      for (const idx of uncachedIndices) {
        if (results[idx] === null) results[idx] = "/placeholder-product.svg";
      }
    }
  }

  return results.map((r) => r ?? "/placeholder-product.svg");
}

/** Check if path is an external URL or storage path */
export function isExternalUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}
