import { createClient } from "@/lib/supabase/client";

const CACHE_TTL = 50 * 60 * 1000; // 50 min - signed URLs expire at 60 min
const LS_KEY = "ugc_img_cache";

type CacheEntry = { url: string; expiry: number };

// ---------------------------------------------------------------------------
// Persistent cache: in-memory Map backed by localStorage
// ---------------------------------------------------------------------------

function loadPersistedCache(): Map<string, CacheEntry> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    const map = new Map<string, CacheEntry>();
    for (const [k, v] of Object.entries(parsed)) {
      if (v.expiry > now) map.set(k, v); // drop expired entries
    }
    return map;
  } catch {
    return new Map();
  }
}

const cache = loadPersistedCache();

// Debounced write so we batch rapid cache.set() calls into one write
let _lsTimer: number | null = null;
function flushToLocalStorage() {
  if (typeof window === "undefined") return;
  if (_lsTimer !== null) clearTimeout(_lsTimer);
  _lsTimer = window.setTimeout(() => {
    try {
      const obj: Record<string, CacheEntry> = {};
      cache.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch {
      // Ignore quota errors
    }
    _lsTimer = null;
  }, 100);
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Preload image URLs into the browser cache so they display instantly
 * on the next render. Fire-and-forget - never awaited.
 */
export function preloadImages(urls: string[]): void {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url || url.startsWith("/")) continue; // skip placeholders
    const img = new window.Image();
    img.src = url;
  }
}

/** Generate a signed URL for a private storage path (memory + localStorage cache) */
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
    flushToLocalStorage();
    return url;
  } catch {
    return "/placeholder-product.svg";
  }
}

/** Batch signed URLs (each cached individually in memory + localStorage) */
export async function getSignedImageUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<string[]> {
  if (paths.length === 0) return [];

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

  if (uncachedPaths.length > 0) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(uncachedPaths, expiresIn);

    if (!error && data) {
      for (let j = 0; j < data.length; j++) {
        const url = data[j].signedUrl || "/placeholder-product.svg";
        results[uncachedIndices[j]] = url;
        cache.set(`${bucket}:${uncachedPaths[j]}`, {
          url,
          expiry: Date.now() + CACHE_TTL,
        });
      }
      flushToLocalStorage();
    } else {
      for (const idx of uncachedIndices) {
        if (results[idx] === null) results[idx] = "/placeholder-product.svg";
      }
    }
  }

  return results.map((r) => r ?? "/placeholder-product.svg");
}

/** Check if path is an external URL or a storage path */
export function isExternalUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}
