import { createClient } from "@/lib/supabase/client";

/** Generate a signed URL for a private storage path */
export async function getSignedImageUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return "/placeholder-product.svg";
    return data.signedUrl;
  } catch {
    return "/placeholder-product.svg";
  }
}

/** Batch signed URLs */
export async function getSignedImageUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<string[]> {
  if (paths.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return paths.map(() => "/placeholder-product.svg");
  return data.map((item) => item.signedUrl || "/placeholder-product.svg");
}

/** Check if path is an external URL or storage path */
export function isExternalUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}
