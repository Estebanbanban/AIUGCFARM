import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const db = getAdminClient();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const generationId = formData.get("generation_id") as string | null;

    if (!file || !generationId) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "file and generation_id are required", 400, cors);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "File too large (max 500MB)", 400, cors);
    }

    // Verify the generation belongs to this user
    const { data: gen, error: genErr } = await db
      .from("generations")
      .select("id")
      .eq("id", generationId)
      .eq("owner_id", userId)
      .single();

    if (genErr || !gen) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Generation not found", 404, cors);
    }

    const storagePath = `${userId}/${generationId}/stitched.mp4`;

    // Upload to generated-videos bucket (upsert to overwrite previous stitches)
    const { error: uploadErr } = await db.storage
      .from("generated-videos")
      .upload(storagePath, file, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadErr) {
      console.error("upload-stitched-video storage error:", uploadErr);
      throw new Error("Failed to upload stitched video");
    }

    return json({ data: { storage_path: storagePath } }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("upload-stitched-video error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
