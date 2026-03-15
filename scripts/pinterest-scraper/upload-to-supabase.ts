import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { createHash } from "crypto";

const IMAGES_DIR = join(import.meta.dir, "../../pinterest-images");

// Read env vars -- user needs to set these
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  console.error(
    "Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx bun run upload-to-supabase.ts <admin-uuid>"
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// The owner_id for system/admin collections (shared across users)
const ADMIN_USER_ID = process.argv[2];
if (!ADMIN_USER_ID) {
  console.error("Usage: bun run upload-to-supabase.ts <admin-user-uuid>");
  process.exit(1);
}

let categories: string[];
try {
  categories = await readdir(IMAGES_DIR);
} catch {
  console.error(`Images directory not found: ${IMAGES_DIR}`);
  console.error("Run the scraper first: bun run scrape.ts ...");
  process.exit(1);
}

const imageCategories = categories.filter(
  (c) => !c.startsWith(".") && !c.startsWith("_")
);

console.log(`Found ${imageCategories.length} categories to upload\n`);

for (const category of imageCategories) {
  const categoryPath = join(IMAGES_DIR, category);
  const dirStat = await stat(categoryPath);
  if (!dirStat.isDirectory()) continue;

  console.log(`\n=== Uploading: ${category} ===`);

  // Load _metadata.json for pin dimensions and descriptions
  let pinMetadata: Record<string, { width?: number; height?: number; description?: string; description_ai?: string }> = {};
  try {
    const metaRaw = await readFile(join(categoryPath, "_metadata.json"), "utf-8");
    const metaJson = JSON.parse(metaRaw);
    if (metaJson.pins && Array.isArray(metaJson.pins)) {
      for (const pin of metaJson.pins) {
        if (pin.filename) {
          pinMetadata[pin.filename] = {
            width: pin.width || 0,
            height: pin.height || 0,
            description: pin.description || pin.description_ai || "",
            description_ai: pin.description_ai || "",
          };
        }
      }
    }
  } catch {
    console.log(`  No _metadata.json found, dimensions will be 0`);
  }

  const collectionName = `${category.charAt(0).toUpperCase() + category.slice(1)} Images`;

  // Check if collection already exists for this owner
  const { data: existingCollections } = await sb
    .from("image_collections")
    .select("id")
    .eq("owner_id", ADMIN_USER_ID)
    .eq("name", collectionName)
    .limit(1);

  let collectionId: string;

  if (existingCollections && existingCollections.length > 0) {
    collectionId = existingCollections[0].id;
    console.log(`  Reusing existing collection: ${collectionId}`);
  } else {
    // Create collection in the database
    const { data: collection, error: collErr } = await sb
      .from("image_collections")
      .insert({
        owner_id: ADMIN_USER_ID,
        name: collectionName,
        description: `Pre-curated ${category} aesthetic images for slideshows`,
      })
      .select("id")
      .single();

    if (collErr) {
      console.error(`  [FAIL] Create collection: ${collErr.message}`);
      continue;
    }

    collectionId = collection.id;
    console.log(`  Collection created: ${collectionId}`);
  }

  // Load existing content hashes for this collection to prevent duplicates
  const { data: existingImages } = await sb
    .from("collection_images")
    .select("content_hash")
    .eq("collection_id", collectionId)
    .not("content_hash", "is", null);

  const existingHashes = new Set<string>(
    (existingImages || []).map((img: any) => img.content_hash).filter(Boolean)
  );

  // Get all image files in the category directory
  const files = (await readdir(categoryPath))
    .filter((f) =>
      [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())
    )
    .sort();

  console.log(`  ${files.length} images to upload (${existingHashes.size} already in collection)`);

  let uploaded = 0;
  let failed = 0;
  let skippedDupes = 0;

  for (const filename of files) {
    const filePath = join(categoryPath, filename);
    const fileBuffer = await readFile(filePath);
    const ext = extname(filename).slice(1);

    // Compute SHA-256 content hash
    const contentHash = createHash("sha256").update(fileBuffer).digest("hex");

    // Skip duplicate images
    if (existingHashes.has(contentHash)) {
      skippedDupes++;
      continue;
    }

    const storagePath = `${ADMIN_USER_ID}/${collectionId}/${filename}`;

    // Upload to Supabase storage bucket
    const { error: uploadErr } = await sb.storage
      .from("slideshow-images")
      .upload(storagePath, fileBuffer, {
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: false,
      });

    if (uploadErr) {
      console.log(`    [FAIL] ${filename}: ${uploadErr.message}`);
      failed++;
      continue;
    }

    // Get dimensions from metadata
    const meta = pinMetadata[filename] || {};
    const fileStat = await stat(filePath);

    // Insert metadata row into the database
    const { error: insertErr } = await sb
      .from("collection_images")
      .insert({
        collection_id: collectionId,
        owner_id: ADMIN_USER_ID,
        storage_path: storagePath,
        filename,
        size_bytes: fileStat.size,
        width: meta.width || null,
        height: meta.height || null,
        content_hash: contentHash,
      });

    if (insertErr) {
      console.log(`    [FAIL] DB insert ${filename}: ${insertErr.message}`);
      failed++;
      continue;
    }

    existingHashes.add(contentHash);
    uploaded++;
    if (uploaded % 10 === 0)
      console.log(`    ${uploaded}/${files.length} uploaded`);
  }

  console.log(
    `  Done: ${uploaded} uploaded, ${failed} failed, ${skippedDupes} skipped (duplicate) -> collection: ${category}`
  );
}

console.log("\n\nAll categories uploaded to Supabase!");
