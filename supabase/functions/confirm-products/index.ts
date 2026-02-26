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
    const { product_ids, edits } = await req.json();

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return json({ detail: "product_ids must be a non-empty array" }, cors, 400);
    }

    const sb = getAdminClient();

    // Verify ownership of all products
    const { data: owned, error: fetchErr } = await sb
      .from("products")
      .select("id")
      .in("id", product_ids)
      .eq("owner_id", userId);

    if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);

    const ownedIds = new Set((owned ?? []).map((r: { id: string }) => r.id));
    const unauthorized = product_ids.filter(
      (id: string) => !ownedIds.has(id),
    );
    if (unauthorized.length > 0) {
      return json(
        { detail: `Products not found or not owned: ${unauthorized.join(", ")}` },
        cors,
        403,
      );
    }

    // Apply edits and confirm each product
    const results: { id: string; updated: boolean }[] = [];

    for (const productId of product_ids) {
      const updates: Record<string, unknown> = { confirmed: true };

      // Merge edits if provided for this product
      if (edits && typeof edits === "object" && edits[productId]) {
        const allowed = ["name", "description", "price", "currency", "category", "images"];
        for (const key of allowed) {
          if (edits[productId][key] !== undefined) {
            updates[key] = edits[productId][key];
          }
        }
      }

      const { error: updateErr } = await sb
        .from("products")
        .update(updates)
        .eq("id", productId)
        .eq("owner_id", userId);

      results.push({ id: productId, updated: !updateErr });
      if (updateErr) console.error(`Failed to update ${productId}:`, updateErr);
    }

    return json({ data: { confirmed: results } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("confirm-products error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
