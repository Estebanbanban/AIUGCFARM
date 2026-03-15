import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);

    const formData = await req.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return json({ detail: "Missing or invalid 'image' field" }, cors, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return json(
        { detail: "Invalid image type. Allowed: image/jpeg, image/png, image/webp" },
        cors,
        400,
      );
    }

    if (file.size > MAX_SIZE) {
      return json({ detail: "Image exceeds 10 MB limit" }, cors, 400);
    }

    const ext = EXT_MAP[file.type];
    const uuid = crypto.randomUUID();
    const storagePath = `${userId}/${uuid}.${ext}`;

    const sb = getAdminClient();
    const { error: uploadErr } = await sb.storage
      .from("reference-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("upload-reference-image upload error:", uploadErr.message);
      return json({ detail: "Failed to upload image" }, cors, 500);
    }

    return json({ data: { path: storagePath } }, cors, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("upload-reference-image error:", e);
    return json({ detail: msg || "Upload failed" }, cors, 500);
  }
});
