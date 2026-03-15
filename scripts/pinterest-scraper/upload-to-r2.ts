/**
 * Upload pinterest-scraped images to Cloudflare R2 (replacing upload-to-supabase.ts).
 *
 * Reads images from ../../pinterest-images/<category>/ directories,
 * uploads them to R2 at slideshow-images/{owner_id}/{collection_id}/{filename},
 * and inserts metadata rows into the Supabase `collection_images` table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run upload-to-r2.ts <admin-user-uuid>
 *
 * R2 credentials are loaded from ../scripts/.env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_URL).
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, resolve } from "path";
import { createHash } from "crypto";
import { config } from "dotenv";

// ---------- Load .env from scripts/.env ----------
const envPath = resolve(import.meta.dir, "../.env");
if (existsSync(envPath)) {
  config({ path: envPath });
}

const IMAGES_DIR = join(import.meta.dir, "../../pinterest-images");

// ---------- Supabase ----------
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  console.error(
    "Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx bun run upload-to-r2.ts <admin-uuid>",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------- R2 ----------
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ENDPOINT) {
  console.error("Missing R2 env vars. Ensure scripts/.env contains:");
  console.error("  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_URL");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------- CLI args ----------
const ADMIN_USER_ID = process.argv[2];
if (!ADMIN_USER_ID) {
  console.error("Usage: bun run upload-to-r2.ts <admin-user-uuid>");
  process.exit(1);
}

// ---------- Main ----------

let categories: string[];
try {
  categories = await readdir(IMAGES_DIR);
} catch {
  console.error(`Images directory not found: ${IMAGES_DIR}`);
  console.error("Run the scraper first: bun run scrape.ts ...");
  process.exit(1);
}

const imageCategories = categories.filter(
  (c) => !c.startsWith(".") && !c.startsWith("_"),
);

console.log(`Found ${imageCategories.length} categories to upload`);
console.log(`R2 bucket: ${R2_BUCKET_NAME}`);
console.log(`R2 public URL: ${R2_PUBLIC_URL}\n`);

for (const category of imageCategories) {
  const categoryPath = join(IMAGES_DIR, category);
  const dirStat = await stat(categoryPath);
  if (!dirStat.isDirectory()) continue;

  console.log(`\n=== Uploading: ${category} ===`);

  // Load _metadata.json for pin dimensions and descriptions
  let pinMetadata: Record<
    string,
    { width?: number; height?: number; description?: string; description_ai?: string }
  > = {};
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
    (existingImages || []).map((img: any) => img.content_hash).filter(Boolean),
  );

  // Get all image files in the category directory
  const files = (await readdir(categoryPath))
    .filter((f) =>
      [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()),
    )
    .sort();

  console.log(
    `  ${files.length} images to upload (${existingHashes.size} already in collection)`,
  );

  let uploaded = 0;
  let failed = 0;
  let skippedDupes = 0;

  for (const filename of files) {
    const filePath = join(categoryPath, filename);
    if (!existsSync(filePath)) continue;
    const fileBuffer = await readFile(filePath);
    const ext = extname(filename).slice(1).toLowerCase();

    // Compute SHA-256 content hash
    const contentHash = createHash("sha256").update(fileBuffer).digest("hex");

    // Skip duplicate images
    if (existingHashes.has(contentHash)) {
      skippedDupes++;
      continue;
    }

    const storagePath = `${ADMIN_USER_ID}/${collectionId}/${filename}`;
    const r2Key = `slideshow-images/${storagePath}`;
    const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Upload to R2
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );
    } catch (err: any) {
      console.log(`    [FAIL] R2 upload ${filename}: ${err.message}`);
      failed++;
      continue;
    }

    // Get dimensions from metadata
    const meta = pinMetadata[filename] || {};
    const fileStat = await stat(filePath);

    // Insert metadata row into the database
    const { error: insertErr } = await sb.from("collection_images").insert({
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
    if (uploaded % 10 === 0) console.log(`    ${uploaded}/${files.length} uploaded`);
  }

  console.log(
    `  Done: ${uploaded} uploaded, ${failed} failed, ${skippedDupes} skipped (duplicate) -> collection: ${category}`,
  );
}

console.log("\n\nAll categories uploaded to Cloudflare R2!");
console.log(`Public URL pattern: ${R2_PUBLIC_URL}/slideshow-images/{owner_id}/{collection_id}/{filename}`);
