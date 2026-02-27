import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { editCompositeFromReference } from "../_shared/nanobanana.ts";

const MAX_EDIT_PROMPT_CHARS = 500;

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

    // Only allow editing composite images owned by this user.
    if (!composite_image_path.startsWith(`${userId}/`)) {
      return json({ detail: "Access denied for this composite image" }, cors, 403);
    }

    const { data: referenceSigned, error: signErr } = await sb.storage
      .from("composite-images")
      .createSignedUrl(composite_image_path, 600);

    if (signErr || !referenceSigned?.signedUrl) {
      throw new Error(`Failed to sign composite image URL: ${signErr?.message}`);
    }

    const edited = await withRetry(
      () => editCompositeFromReference(
        referenceSigned.signedUrl,
        edit_prompt.trim(),
        format as "9:16" | "16:9",
      ),
      4,
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
