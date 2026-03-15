import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const userId = await requireUserId(req);
    const body = await req.json() as {
      generation_id: string;
      screen_recording_url: string | null;
    };

    if (!body?.generation_id) {
      return json({ detail: "Missing generation_id" }, cors, 400);
    }

    // Validate the storage path belongs to the user (if not null)
    if (
      body.screen_recording_url &&
      (typeof body.screen_recording_url !== "string" ||
        body.screen_recording_url.includes("..") ||
        !body.screen_recording_url.startsWith(userId + "/"))
    ) {
      return json({ detail: "Invalid screen recording path" }, cors, 403);
    }

    const sb = getAdminClient();

    // Verify generation ownership
    const { data: gen, error: genErr } = await sb
      .from("generations")
      .select("id")
      .eq("id", body.generation_id)
      .eq("owner_id", userId)
      .single();

    if (genErr || !gen) {
      return json({ detail: "Generation not found" }, cors, 404);
    }

    const { error: updateErr } = await sb
      .from("generations")
      .update({ screen_recording_url: body.screen_recording_url })
      .eq("id", body.generation_id)
      .eq("owner_id", userId);

    if (updateErr) throw new Error(updateErr.message);

    return json({ data: { ok: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("update-screen-recording error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
