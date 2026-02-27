import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extract and verify the authenticated user from the Authorization header.
 * Throws "Unauthorized" if the token is missing or invalid.
 */
export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Unauthorized");

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const keys = Array.from(new Set([anonKey, serviceKey].filter(Boolean))) as string[];

  let lastError: string | null = null;
  for (const key of keys) {
    const supabase = createClient(supabaseUrl, key, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user && !error) return user.id;
    lastError = error?.message ?? "No user in token";
  }

  console.error("requireUserId auth verification failed:", lastError);
  throw new Error("Unauthorized");
}

export async function optionalUserId(req: Request): Promise<string | null> {
  try {
    return await requireUserId(req);
  } catch {
    return null;
  }
}
