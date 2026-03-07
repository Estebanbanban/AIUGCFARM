import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const PRESET_LIMITS: Record<string, number> = {
  free: 3,
  starter: 5,
  growth: 10,
  scale: Infinity,
};

const REQUIRED_CONFIG_FIELDS = [
  "product_id",
  "persona_id",
  "mode",
  "quality",
  "format",
  "language",
];

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { name, config } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return json({ detail: "name is required" }, cors, 400);
    }

    if (!config || typeof config !== "object") {
      return json({ detail: "config is required" }, cors, 400);
    }

    const missingFields = REQUIRED_CONFIG_FIELDS.filter(
      (field) => !(field in config) || config[field] == null,
    );
    if (missingFields.length > 0) {
      return json(
        { detail: `config is missing required fields: ${missingFields.join(", ")}` },
        cors,
        400,
      );
    }

    // Fetch plan
    const { data: profile } = await sb
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    const plan = (profile?.plan as string) ?? "free";
    const limit = PRESET_LIMITS[plan] ?? 3;

    if (limit !== Infinity) {
      const { count } = await sb
        .from("generation_presets")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);

      if ((count ?? 0) >= limit) {
        return json(
          { detail: `Preset limit reached (${limit}) for your ${plan} plan. Upgrade to add more presets.` },
          cors,
          403,
        );
      }
    }

    const { data: preset, error } = await sb
      .from("generation_presets")
      .insert({ owner_id: userId, name: name.trim(), config })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return json({ data: preset }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    console.error("create-preset error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
