/**
 * AI Vision Filter for Pinterest scraped images.
 *
 * Runs each image through Claude Haiku vision to classify:
 * - KEEP: Real candid/UGC-style photo (desk, workspace, lifestyle, person studying/working)
 * - REJECT: Infographic, graphic design, slideshow, illustration, stock photo, product shot,
 *           collage, text-heavy image, screenshot, meme, or overly polished/staged photo
 *
 * Saves classification data (verdict, AI description, timestamp) into _metadata.json.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... bun run filter-images.ts [category]
 *   OPENROUTER_API_KEY=sk-... bun run filter-images.ts education
 *   OPENROUTER_API_KEY=sk-... bun run filter-images.ts          # all categories
 */

import { readdir, readFile, writeFile, unlink, rename, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";

const IMAGES_DIR = join(import.meta.dir, "../../pinterest-images");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

if (!OPENROUTER_API_KEY) {
  console.error("Set OPENROUTER_API_KEY env var");
  process.exit(1);
}

interface ClassificationResult {
  verdict: "KEEP" | "REJECT";
  description: string;
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

Reply with ONLY valid JSON (no markdown, no code fences): {"verdict":"KEEP","description":"a cozy desk with laptop and coffee, dark moody lighting"} or {"verdict":"REJECT","description":"professional studio product shot on white background"}`;

async function classifyImage(imagePath: string): Promise<ClassificationResult> {
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
      max_tokens: 100,
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
              text: `${SYSTEM_PROMPT}\n\nClassify this image. Reply with ONLY valid JSON.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`  API error: ${response.status} ${err.slice(0, 200)}`);
    return { verdict: "KEEP", description: "" }; // Don't delete on API errors
  }

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content?.trim() ?? "";

  // Try to parse JSON response
  try {
    const parsed = JSON.parse(text);
    const verdict = String(parsed.verdict).toUpperCase().includes("REJECT") ? "REJECT" : "KEEP";
    const description = String(parsed.description || "").slice(0, 200);
    return { verdict: verdict as "KEEP" | "REJECT", description };
  } catch {
    // Fallback: parse as plain text
    const verdict = text.toUpperCase().includes("REJECT") ? "REJECT" : "KEEP";
    return { verdict: verdict as "KEEP" | "REJECT", description: "" };
  }
}

async function classifyWithRetry(imagePath: string, retries = 2): Promise<ClassificationResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await classifyImage(imagePath);
    } catch (err) {
      if (attempt < retries) {
        console.error(`  Connection error, retrying in 3s... (${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error(`  Failed after ${retries + 1} attempts, keeping image`);
        return { verdict: "KEEP", description: "" };
      }
    }
  }
  return { verdict: "KEEP", description: "" };
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

  // Load existing _metadata.json
  const metadataPath = join(categoryPath, "_metadata.json");
  let metadata: any = {};
  try {
    const raw = await readFile(metadataPath, "utf-8");
    metadata = JSON.parse(raw);
  } catch {
    // No metadata file yet — that's fine
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

    const result = await classifyWithRetry(filePath);

    // Update _metadata.json pin entry with classification data
    if (metadata.pins && Array.isArray(metadata.pins)) {
      const pinEntry = metadata.pins.find((p: any) => p.filename === file);
      if (pinEntry) {
        pinEntry.verdict = result.verdict;
        pinEntry.description_ai = result.description;
        pinEntry.filtered_at = new Date().toISOString();
      }
    }

    if (result.verdict === "REJECT") {
      // Move to _rejected folder instead of deleting
      await rename(filePath, join(rejectedDir, file));
      rejected++;
      console.log(`  [REJECT] ${file} — ${result.description || "no desc"} (${i + 1}/${files.length})`);
    } else {
      kept++;
      if ((i + 1) % 20 === 0) {
        console.log(`  ... ${i + 1}/${files.length} processed (${kept} kept, ${rejected} rejected)`);
      }
    }

    // Rate limit: ~2 req/sec to avoid connection resets
    await new Promise((r) => setTimeout(r, 500));
  }

  // Save updated _metadata.json after processing each category
  if (metadata.pins) {
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  Metadata updated: ${metadataPath}`);
  }

  totalKept += kept;
  totalRejected += rejected;
  console.log(`  Result: ${kept} kept, ${rejected} rejected`);
}

console.log(`\n\nDone! Total: ${totalKept} kept, ${totalRejected} rejected`);
console.log("Rejected images moved to _rejected/ folders (not deleted).");
console.log("Classification data (verdict, description_ai, filtered_at) saved to _metadata.json files.");
