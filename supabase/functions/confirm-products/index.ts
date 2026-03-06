import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const MIGRATION_DATE = "2026-03-06T00:00:00.000Z";

const PRODUCTS_PER_BRAND_LIMITS: Record<string, number> = {
  free: 3,
  starter: 5,
  growth: 20,
  scale: Infinity,
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const { product_ids, edits, brand_id } = await req.json();

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return json({ detail: "product_ids must be a non-empty array" }, cors, 400);
    }
    if (product_ids.length > 100) {
      return json({ detail: "product_ids must contain 100 items or fewer per request" }, cors, 400);
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
    const unauthorized = product_ids.filter((id: string) => !ownedIds.has(id));
    if (unauthorized.length > 0) {
      return json(
        { detail: `Products not found or not owned: ${unauthorized.join(", ")}` },
        cors,
        403,
      );
    }

    // Per-brand product limit check (if brand_id provided)
    if (brand_id && typeof brand_id === "string") {
      // Verify brand ownership
      const { data: brand } = await sb
        .from("brands")
        .select("id, owner_id")
        .eq("id", brand_id)
        .maybeSingle();

      if (!brand || brand.owner_id !== userId) {
        return json({ detail: "Brand not found" }, cors, 404);
      }

      // Get plan
      const { data: profile } = await sb
        .from("profiles")
        .select("plan, role")
        .eq("id", userId)
        .maybeSingle();

      const plan = (profile?.plan as string) ?? "free";
      const isAdmin = profile?.role === "admin";

      if (!isAdmin) {
        const limit = PRODUCTS_PER_BRAND_LIMITS[plan] ?? 3;

        if (limit !== Infinity) {
          // Count only products confirmed AFTER migration date (grandfathered exemption)
          const { count: existingCount } = await sb
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", brand_id)
            .eq("confirmed", true)
            .gte("created_at", MIGRATION_DATE);

          const newCount = product_ids.length;
          const totalAfter = (existingCount ?? 0) + newCount;

          if (totalAfter > limit) {
            return json(
              {
                detail: `Product limit for this brand would be exceeded. Limit: ${limit} per brand on your ${plan} plan. Currently: ${existingCount ?? 0}, adding: ${newCount}.`,
              },
              cors,
              403,
            );
          }
        }
      }
    }

    // Validate edits before applying
    if (edits && typeof edits === "object") {
      for (const productId of product_ids) {
        const edit = edits[productId];
        if (!edit) continue;

        if (edit.name !== undefined) {
          if (typeof edit.name !== "string" || edit.name.trim().length === 0) {
            return json(
              { detail: `Invalid name for product ${productId}: must be a non-empty string` },
              cors,
              400,
            );
          }
        }

        if (edit.price !== undefined && edit.price !== null) {
          const price = Number(edit.price);
          if (isNaN(price) || price < 0) {
            return json(
              { detail: `Invalid price for product ${productId}: must be a number >= 0` },
              cors,
              400,
            );
          }
        }

        if (edit.images !== undefined) {
          if (!Array.isArray(edit.images)) {
            return json(
              { detail: `Invalid images for product ${productId}: must be an array` },
              cors,
              400,
            );
          }
        }
      }
    }

    // Apply edits and confirm each product
    const results: { id: string; updated: boolean }[] = [];

    for (const productId of product_ids) {
      const updates: Record<string, unknown> = { confirmed: true };

      if (brand_id && typeof brand_id === "string") {
        updates.brand_id = brand_id;
      }

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
