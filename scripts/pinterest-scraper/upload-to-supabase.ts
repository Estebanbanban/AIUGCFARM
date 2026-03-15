import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "fs/promises";
import { join, extname } from "path";

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

  // Create collection in the database
  const { data: collection, error: collErr } = await sb
    .from("image_collections")
    .insert({
      owner_id: ADMIN_USER_ID,
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} Images`,
      description: `Pre-curated ${category} aesthetic images for slideshows`,
    })
    .select("id")
    .single();

  if (collErr) {
    console.error(`  [FAIL] Create collection: ${collErr.message}`);
    continue;
  }

  const collectionId = collection.id;
  console.log(`  Collection created: ${collectionId}`);

  // Get all image files in the category directory
  const files = (await readdir(categoryPath))
    .filter((f) =>
      [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())
    )
    .sort();

  console.log(`  ${files.length} images to upload`);

  let uploaded = 0;
  let failed = 0;

  for (const filename of files) {
    const filePath = join(categoryPath, filename);
    const fileBuffer = await readFile(filePath);
    const ext = extname(filename).slice(1);
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

    // Insert metadata row into the database
    const fileStat = await stat(filePath);
    const { error: insertErr } = await sb
      .from("collection_images")
      .insert({
        collection_id: collectionId,
        owner_id: ADMIN_USER_ID,
        storage_path: storagePath,
        filename,
        size_bytes: fileStat.size,
      });

    if (insertErr) {
      console.log(`    [FAIL] DB insert ${filename}: ${insertErr.message}`);
      failed++;
      continue;
    }

    uploaded++;
    if (uploaded % 10 === 0)
      console.log(`    ${uploaded}/${files.length} uploaded`);
  }

  console.log(
    `  Done: ${uploaded}/${files.length} uploaded, ${failed} failed -> collection: ${category}`
  );
}

console.log("\n\nAll categories uploaded to Supabase!");
