import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await sb
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    // Get paginated results with related product and persona names
    const { data: generations, error } = await sb
      .from("generations")
      .select(
        `
        id,
        product_id,
        persona_id,
        mode,
        status,
        script,
        composite_image_url,
        videos,
        error_message,
        started_at,
        completed_at,
        created_at,
        products ( name, images ),
        personas ( name, selected_image_url )
      `,
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Query failed: ${error.message}`);

    const totalPages = Math.ceil((count ?? 0) / limit);

    return json({
      data: {
        generations: generations ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generation-history error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
