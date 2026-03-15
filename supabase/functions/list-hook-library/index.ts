import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Auth required but we don't filter by user — hook library is global
    await requireUserId(req);
    const sb = getAdminClient();

    const { data: hooks, error } = await sb
      .from("hook_library")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    // Generate public URLs for each hook video
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const withUrls = (hooks ?? []).map((hook) => ({
      ...hook,
      video_url: `${supabaseUrl}/storage/v1/object/public/hook-library/${hook.storage_path}`,
      thumbnail_url: hook.thumbnail_path
        ? `${supabaseUrl}/storage/v1/object/public/hook-library/${hook.thumbnail_path}`
        : null,
    }));

    return json({ data: withUrls }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-hook-library error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
