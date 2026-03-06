import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { editCompositeFromReference } from "../_shared/nanobanana.ts";

const MAX_EDIT_PROMPT_CHARS = 500;
const DAILY_EDIT_LIMIT_FREE = 15;
const DAILY_EDIT_LIMIT_PAID = 60;

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const {
      composite_image_path,
      edit_prompt,
      format = "9:16",
    } = await req.json();

    if (!composite_image_path || typeof composite_image_path !== "string") {
      return json({ detail: "composite_image_path is required" }, cors, 400);
    }
    if (typeof edit_prompt !== "string" || edit_prompt.trim().length === 0) {
      return json({ detail: "edit_prompt is required" }, cors, 400);
    }
    if (edit_prompt.trim().length > MAX_EDIT_PROMPT_CHARS) {
      return json(
        { detail: `edit_prompt must be ${MAX_EDIT_PROMPT_CHARS} characters or fewer` },
        cors,
        400,
      );
    }
    if (format !== "9:16" && format !== "16:9") {
      return json({ detail: "format must be '9:16' or '16:9'" }, cors, 400);
    }

    // Fair-use limit for composite edits to control model costs.
    const { data: profile } = await sb
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();
    const dailyLimit = profile?.plan === "free" ? DAILY_EDIT_LIMIT_FREE : DAILY_EDIT_LIMIT_PAID;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await sb
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("reason", "composite_generation")
      .gte("created_at", todayStart.toISOString());
    if ((todayCount ?? 0) >= dailyLimit) {
      return json(
        { detail: `Daily image edit limit reached (${dailyLimit}/day). Try again tomorrow.` },
        cors,
        429,
      );
    }

    // Only allow editing composite images owned by this user.
    // Check first path component exactly (prevents ../traversal attacks).
    if (
      composite_image_path.includes("..") ||
      composite_image_path.split("/")[0] !== userId
    ) {
      return json({ detail: "Access denied for this composite image" }, cors, 403);
    }

    const { data: referenceSigned, error: signErr } = await sb.storage
      .from("composite-images")
      .createSignedUrl(composite_image_path, 600, {
        transform: {
          width: format === "9:16" ? 960 : 1280,
          quality: 82,
        },
      });

    if (signErr || !referenceSigned?.signedUrl) {
      throw new Error(`Failed to sign composite image URL: ${signErr?.message}`);
    }

    const edited = await withRetry(
      () => editCompositeFromReference(
        referenceSigned.signedUrl,
        edit_prompt.trim(),
        format as "9:16" | "16:9",
      ),
      2,
      1000,
    );

    const ext = edited.mimeType.includes("png") ? "png" : "jpg";
    const storagePath = `${userId}/preview/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from("composite-images")
      .upload(storagePath, edited.data, {
        contentType: edited.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Failed to upload edited image: ${uploadErr.message}`);
    }

    const { data: signedData, error: signedErr } = await sb.storage
      .from("composite-images")
      .createSignedUrl(storagePath, 3600);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`Failed to sign edited image URL: ${signedErr?.message}`);
    }

    await sb.from("credit_ledger").insert({
      owner_id: userId,
      amount: 0,
      reason: "composite_generation",
    });

    return json(
      {
        data: {
          image: {
            path: storagePath,
            signed_url: signedData.signedUrl,
          },
        },
      },
      cors,
      200,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("edit-composite-image error:", e);
    return json(
      { detail: msg || "Failed to edit preview image. Please try again." },
      cors,
      500,
    );
  }
});
