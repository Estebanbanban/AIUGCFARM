import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const { name, description } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return json({ detail: "name is required" }, cors, 400);
    }

    const sb = getAdminClient();

    const { data: collection, error } = await sb
      .from("image_collections")
      .insert({
        owner_id: userId,
        name: name.trim(),
        description: description ?? null,
      })
      .select("id, name, description, image_count, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);

    return json({ data: collection }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("create-image-collection error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
