/**
 * Migrate ALL images from local pinterest-images/ to Cloudflare R2.
 * Ignores DB dedup — uploads every file that exists on disk.
 * Reads storage_path from collection_images DB to know the R2 key.
 *
 * Usage:
 *   source ../scripts/.env && source ../supabase/.env.local && \
 *   SUPABASE_URL=https://nuodqvvgfwptnnlvmqbe.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
 *   bun run migrate-to-r2.ts
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { config } from "dotenv";

// Load env from scripts/.env
config({ path: join(import.meta.dir, "../../scripts/.env") });

const IMAGES_DIR = join(import.meta.dir, "../../pinterest-images");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Get ALL collection_images from DB
console.log("Fetching all collection images from DB...");
// Fetch all images in batches (Supabase limits to 1000 per query)
let allImages: any[] = [];
let offset = 0;
const batchSize = 1000;
while (true) {
  const { data: batch, error: batchErr } = await sb
    .from("collection_images")
    .select("id, storage_path, filename, collection_id")
    .range(offset, offset + batchSize - 1);
  if (batchErr) { console.error("DB error:", batchErr.message); process.exit(1); }
  if (!batch || batch.length === 0) break;
  allImages = allImages.concat(batch);
  if (batch.length < batchSize) break;
  offset += batchSize;
}
const error = null;

if (error) {
  console.error("DB error:", error.message);
  process.exit(1);
}

console.log(`Found ${allImages?.length ?? 0} images in DB\n`);

// Group by collection to find the category directory
const { data: collections } = await sb
  .from("image_collections")
  .select("id, name");

const collectionNameMap = new Map<string, string>();
for (const c of collections ?? []) {
  // "Education Images" -> "education", "Fitness_gym Images" -> "fitness_gym"
  const slug = c.name.replace(" Images", "").toLowerCase().replace(/\s+/g, "_");
  collectionNameMap.set(c.id, slug);
}

let uploaded = 0;
let skipped = 0;
let notFound = 0;
let failed = 0;

for (const img of allImages ?? []) {
  const r2Key = `slideshow-images/${img.storage_path}`;
  const category = collectionNameMap.get(img.collection_id) || "unknown";
  const localPath = join(IMAGES_DIR, category, img.filename);

  // Try to find the file locally
  if (!existsSync(localPath)) {
    // Try other possible locations
    let found = false;
    for (const dir of await readdir(IMAGES_DIR).catch(() => [])) {
      const altPath = join(IMAGES_DIR, dir, img.filename);
      if (existsSync(altPath)) {
        // Upload from this location
        const buffer = await readFile(altPath);
        const ext = extname(img.filename).slice(1).toLowerCase();
        const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

        try {
          await s3.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            Body: buffer,
            ContentType: contentType,
          }));
          uploaded++;
          found = true;
        } catch (e: any) {
          console.error(`  [FAIL] ${img.filename}: ${e.message}`);
          failed++;
          found = true;
        }
        break;
      }
    }
    if (!found) {
      notFound++;
    }
    continue;
  }

  // Upload to R2
  const buffer = await readFile(localPath);
  const ext = extname(img.filename).slice(1).toLowerCase();
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  try {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
    }));
    uploaded++;
  } catch (e: any) {
    console.error(`  [FAIL] ${img.filename}: ${e.message}`);
    failed++;
  }

  if (uploaded % 50 === 0 && uploaded > 0) {
    console.log(`  ${uploaded} uploaded, ${skipped} skipped, ${notFound} not found, ${failed} failed`);
  }
}

console.log(`\nDone!`);
console.log(`  Uploaded: ${uploaded}`);
console.log(`  Not found locally: ${notFound}`);
console.log(`  Failed: ${failed}`);
console.log(`\nImages are now at: ${R2_PUBLIC_URL}/slideshow-images/{storage_path}`);
