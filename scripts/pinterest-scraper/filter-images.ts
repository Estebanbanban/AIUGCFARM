/**
 * AI Vision Filter for Pinterest scraped images.
 *
 * Runs each image through Claude Haiku vision to classify:
 * - KEEP: Real candid/UGC-style photo (desk, workspace, lifestyle, person studying/working)
 * - REJECT: Infographic, graphic design, slideshow, illustration, stock photo, product shot,
 *           collage, text-heavy image, screenshot, meme, or overly polished/staged photo
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun run filter-images.ts [category]
 *   ANTHROPIC_API_KEY=sk-... bun run filter-images.ts education
 *   ANTHROPIC_API_KEY=sk-... bun run filter-images.ts          # all categories
 */

import { readdir, readFile, unlink, rename, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";

const IMAGES_DIR = join(import.meta.dir, "../../pinterest-images");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

if (!OPENROUTER_API_KEY) {
  console.error("Set OPENROUTER_API_KEY env var");
  process.exit(1);
}

const SYSTEM_PROMPT = `You classify images for TikTok/Instagram carousel slideshows. These slideshows use REAL, phone-taken, candid photos as backgrounds — the kind of photos a 22-year-old would take on their iPhone and post to their story.

KEEP only if ALL of these are true:
- Looks like it was taken on a phone (not a professional camera)
- Has natural, imperfect lighting (slightly dark, warm, moody is OK)
- Shows a real scene: desk, laptop, coffee, hands, workspace, gym, kitchen, city walk
- Feels candid/unposed — messy desk, real apartment, actual person's space
- Could realistically be a TikTok slideshow background
- POV or faceless shots are ideal (hands holding things, desk from above, etc.)

REJECT if ANY of these are true:
- Professional photography (DSLR quality, studio lighting, shallow depth of field from a big lens)
- Stock photo vibes (too clean, too perfect, models posing naturally)
- Infographic, chart, diagram, graphic design, illustration
- Text overlay, slideshow slide, screenshot, meme
- Product photo on clean/white background
- Collage or multi-image composite
- 3D render, cartoon, digital art, AI-generated looking
- Interior design / architecture photo (too staged)
- Overly styled flat lay (too perfect arrangement)
- Food photography that looks professional (restaurant quality plating)
- Fitness photos that look like a professional shoot (perfect lighting, posed)

When in doubt, REJECT. We want only the most authentic phone-taken photos.

Reply with ONLY one word: KEEP or REJECT`;

async function classifyImage(imagePath: string): Promise<"KEEP" | "REJECT"> {
  const buffer = await readFile(imagePath);
  const base64 = buffer.toString("base64");
  const ext = extname(imagePath).slice(1).toLowerCase();
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // OpenRouter free vision model
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/healer-alpha",
      max_tokens: 5,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: `${SYSTEM_PROMPT}\n\nClassify this image. Reply with ONLY one word: KEEP or REJECT.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`  API error: ${response.status} ${err.slice(0, 200)}`);
    return "KEEP"; // Don't delete on API errors
  }

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "";
  return text.includes("REJECT") ? "REJECT" : "KEEP";
}

async function classifyWithRetry(imagePath: string, retries = 2): Promise<"KEEP" | "REJECT"> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await classifyImage(imagePath);
    } catch (err) {
      if (attempt < retries) {
        console.error(`  Connection error, retrying in 3s... (${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error(`  Failed after ${retries + 1} attempts, keeping image`);
        return "KEEP";
      }
    }
  }
  return "KEEP";
}

// --- CLI ---
const selectedCategory = process.argv[2];

let categories: string[];
try {
  categories = (await readdir(IMAGES_DIR)).filter(
    (c) => !c.startsWith(".") && !c.startsWith("_")
  );
} catch {
  console.error(`Images directory not found: ${IMAGES_DIR}`);
  process.exit(1);
}

if (selectedCategory) {
  if (!categories.includes(selectedCategory)) {
    console.error(`Unknown category: ${selectedCategory}. Available: ${categories.join(", ")}`);
    process.exit(1);
  }
  categories = [selectedCategory];
}

console.log("Pinterest Image AI Filter");
console.log(`Categories: ${categories.join(", ")}`);
console.log(`Model: openrouter/healer-alpha (free, via OpenRouter)\n`);

let totalKept = 0;
let totalRejected = 0;

for (const category of categories) {
  const categoryPath = join(IMAGES_DIR, category);
  const rejectedDir = join(categoryPath, "_rejected");

  // Create _rejected subfolder
  if (!existsSync(rejectedDir)) {
    await mkdir(rejectedDir, { recursive: true });
  }

  const files = (await readdir(categoryPath)).filter((f) =>
    [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())
  );

  console.log(`\n=== ${category.toUpperCase()} === (${files.length} images)`);

  let kept = 0;
  let rejected = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = join(categoryPath, file);

    const verdict = await classifyWithRetry(filePath);

    if (verdict === "REJECT") {
      // Move to _rejected folder instead of deleting
      await rename(filePath, join(rejectedDir, file));
      rejected++;
      console.log(`  [REJECT] ${file} (${i + 1}/${files.length})`);
    } else {
      kept++;
      if ((i + 1) % 20 === 0) {
        console.log(`  ... ${i + 1}/${files.length} processed (${kept} kept, ${rejected} rejected)`);
      }
    }

    // Rate limit: ~2 req/sec to avoid connection resets
    await new Promise((r) => setTimeout(r, 500));
  }

  totalKept += kept;
  totalRejected += rejected;
  console.log(`  Result: ${kept} kept, ${rejected} rejected`);
}

console.log(`\n\nDone! Total: ${totalKept} kept, ${totalRejected} rejected`);
console.log("Rejected images moved to _rejected/ folders (not deleted).");
