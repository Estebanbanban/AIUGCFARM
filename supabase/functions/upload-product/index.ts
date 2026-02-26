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
    const sb = getAdminClient();

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(
        { detail: "Content-Type must be multipart/form-data" },
        cors,
        400,
      );
    }

    const formData = await req.formData();

    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return json({ detail: "name is required" }, cors, 400);
    }

    const description = (formData.get("description") as string) ?? "";
    const priceStr = formData.get("price") as string | null;
    const price = priceStr ? parseFloat(priceStr) : null;
    const currency = (formData.get("currency") as string) ?? "USD";
    const category = (formData.get("category") as string) ?? null;

    // Upload images to product-images bucket
    const imageUrls: string[] = [];
    const imageFiles = formData.getAll("images");

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (!(file instanceof File)) continue;

      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await sb.storage
        .from("product-images")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        console.error(`Image upload failed: ${uploadErr.message}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = sb.storage.from("product-images").getPublicUrl(storagePath);
      imageUrls.push(publicUrl);
    }

    // Create product record
    const { data: product, error: insertErr } = await sb
      .from("products")
      .insert({
        owner_id: userId,
        name,
        description,
        price,
        currency,
        category,
        images: imageUrls,
        source: "manual",
        confirmed: true,
      })
      .select("id, name, images, source, confirmed")
      .single();

    if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

    return json({ data: product }, cors, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("upload-product error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
