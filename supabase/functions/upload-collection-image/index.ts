import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { r2Upload, r2Delete } from "../_shared/r2.ts";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const formData = await req.formData();
    const collectionId = formData.get("collection_id") as string;
    const files = formData.getAll("file") as File[];

    if (!collectionId || typeof collectionId !== "string") {
      return json({ detail: "collection_id is required" }, cors, 400);
    }

    if (!files || files.length === 0) {
      return json({ detail: "At least one file is required" }, cors, 400);
    }

    // Verify collection belongs to user
    const { data: collection, error: colErr } = await sb
      .from("image_collections")
      .select("id")
      .eq("id", collectionId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (colErr) throw new Error(colErr.message);
    if (!collection) {
      return json({ detail: "Collection not found" }, cors, 404);
    }

    // Validate all files before uploading any
    for (const file of files) {
      if (!(file instanceof File)) {
        return json({ detail: "Invalid file in request" }, cors, 400);
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return json(
          { detail: `Invalid file type: ${file.type}. Allowed: image/jpeg, image/png, image/webp` },
          cors,
          400,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return json(
          { detail: `File "${file.name}" exceeds maximum size of 10MB` },
          cors,
          400,
        );
      }
    }

    // Upload each file to R2 and insert DB rows
    const uploaded: { id: string; storage_path: string; filename: string }[] = [];

    const MIME_TO_EXT: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    for (const file of files) {
      const ext = MIME_TO_EXT[file.type] || "jpg";
      const storagePath = `${userId}/${collectionId}/${crypto.randomUUID()}.${ext}`;
      const r2Key = `slideshow-images/${storagePath}`;

      try {
        const fileBuffer = new Uint8Array(await file.arrayBuffer());
        await r2Upload(r2Key, fileBuffer, file.type);
      } catch (err) {
        console.error(`R2 upload failed for ${file.name}:`, (err as Error).message);
        continue;
      }

      const { data: imageRow, error: insertErr } = await sb
        .from("collection_images")
        .insert({
          collection_id: collectionId,
          owner_id: userId,
          storage_path: storagePath,
          filename: file.name,
          size_bytes: file.size,
        })
        .select("id, storage_path, filename")
        .single();

      if (insertErr) {
        console.error(`DB insert failed for ${file.name}:`, insertErr.message);
        // Clean up the uploaded file from R2
        try {
          await r2Delete(r2Key);
        } catch { /* best effort */ }
        continue;
      }

      uploaded.push(imageRow);
    }

    return json({ data: { uploaded: uploaded.length, images: uploaded } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("upload-collection-image error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
