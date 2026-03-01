import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_COUNT = 5;

const PRODUCT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  growth: 3,
  scale: 10,
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // ── Enforce product limit per plan ──────────────────────────────
    const { data: profileRow } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .maybeSingle();

    const userPlan = (profileRow?.plan as string) ?? "free";
    const isAdmin = profileRow?.role === "admin";

    if (!isAdmin) {
      const limit = PRODUCT_LIMITS[userPlan] ?? 1;
      const { count: existingCount } = await sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);

      if ((existingCount ?? 0) >= limit) {
        return json(
          { detail: `Product limit reached (${limit}) for your ${userPlan} plan. Upgrade to add more products.` },
          cors,
          403,
        );
      }
    }

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

    // Collect and validate image files
    const imageFiles = formData.getAll("images");

    if (imageFiles.length > MAX_IMAGE_COUNT) {
      return json(
        { detail: `Maximum ${MAX_IMAGE_COUNT} images allowed` },
        cors,
        400,
      );
    }

    // Validate all files before uploading any
    for (const file of imageFiles) {
      if (!(file instanceof File)) continue;
      if (!ALLOWED_TYPES.has(file.type)) {
        return json(
          {
            detail: `Invalid file type: ${file.type}. Allowed: image/jpeg, image/png, image/webp`,
          },
          cors,
          400,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return json(
          {
            detail: `File "${file.name}" exceeds maximum size of 5MB`,
          },
          cors,
          400,
        );
      }
    }

    // Upload images to product-images bucket in parallel, storing paths (not public URLs)
    const uploadResults = await Promise.all(
      imageFiles
        .filter((file): file is File => file instanceof File)
        .map(async (file) => {
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
            return null;
          }

          return storagePath;
        })
    );
    const imagePaths = uploadResults.filter((p): p is string => p !== null);

    // Create product record with storage paths (not public URLs)
    const { data: product, error: insertErr } = await sb
      .from("products")
      .insert({
        owner_id: userId,
        name,
        description,
        price,
        currency,
        category,
        images: imagePaths,
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
