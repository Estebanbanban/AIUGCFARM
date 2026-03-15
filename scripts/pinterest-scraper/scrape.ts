import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const OUTPUT_DIR = join(import.meta.dir, "../../pinterest-images");

interface ScrapedPin {
  id: string;
  imageUrl: string;
  description: string;
  width: number;
  height: number;
  content_hash?: string;
}

async function scrapePinterest(
  query: string,
  count: number
): Promise<ScrapedPin[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  const pins: ScrapedPin[] = [];
  const seenUrls = new Set<string>();

  // Intercept network requests to capture pin data from Pinterest's internal API
  page.on("response", async (response) => {
    const url = response.url();
    if (
      url.includes("resource/BaseSearchResource") ||
      url.includes("resource/BoardFeedResource")
    ) {
      try {
        const json = await response.json();
        const results =
          json?.resource_response?.data?.results ||
          json?.resource_response?.data ||
          [];
        for (const pin of results) {
          if (pins.length >= count) break;
          const imgUrl =
            pin?.images?.orig?.url || pin?.images?.["736x"]?.url;
          if (imgUrl && !seenUrls.has(imgUrl)) {
            const pinWidth = pin?.images?.orig?.width || 0;
            const pinHeight = pin?.images?.orig?.height || 0;
            // Reject pins with dimensions below 600px
            if (pinWidth > 0 && pinHeight > 0 && (pinWidth < 600 || pinHeight < 600)) {
              continue;
            }
            seenUrls.add(imgUrl);
            pins.push({
              id:
                pin.id ||
                `pin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              imageUrl: imgUrl,
              description: pin.description || pin.grid_title || "",
              width: pinWidth,
              height: pinHeight,
            });
          }
        }
      } catch {
        // Not all responses are JSON — ignore parse errors
      }
    }
  });

  // Navigate to Pinterest search
  const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
  console.log(`  Navigating to: ${searchUrl}`);

  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    console.log("  Page load timed out, continuing with what we have...");
  }

  // Wait for initial pins to render
  await page.waitForTimeout(3000);

  // Scroll to load more pins — Pinterest lazy-loads ~25 pins per scroll
  let scrollAttempts = 0;
  const maxScrolls = Math.ceil(count / 25) + 5;
  let lastPinCount = 0;
  let staleScrolls = 0;

  while (pins.length < count && scrollAttempts < maxScrolls) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    scrollAttempts++;

    console.log(
      `  Scroll ${scrollAttempts}/${maxScrolls} -- ${pins.length}/${count} pins found`
    );

    // Detect if we've stopped finding new pins (rate limited or end of results)
    if (pins.length === lastPinCount) {
      staleScrolls++;
      if (staleScrolls >= 3) {
        console.log(
          "  No new pins after 3 scrolls, stopping early."
        );
        break;
      }
    } else {
      staleScrolls = 0;
    }
    lastPinCount = pins.length;
  }

  // Fallback: if API interception yielded nothing, scrape from DOM directly
  if (pins.length === 0) {
    console.log(
      "  API interception found 0 pins, falling back to DOM scraping..."
    );
    const domPins = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img[src]"));
      return images
        .filter(
          (img) =>
            img.getAttribute("src")?.includes("pinimg.com") &&
            (img as HTMLImageElement).naturalWidth > 200
        )
        .map((img, i) => {
          const src = img.getAttribute("src") || "";
          // Try to upgrade URL to original resolution
          const origUrl = src
            .replace(/\/\d+x\d*\//, "/originals/")
            .replace(/\/\d+x\//, "/originals/");
          return {
            id: `dom-${Date.now()}-${i}`,
            imageUrl: origUrl,
            description: img.getAttribute("alt") || "",
            width: (img as HTMLImageElement).naturalWidth,
            height: (img as HTMLImageElement).naturalHeight,
          };
        });
    });
    for (const pin of domPins) {
      if (pins.length >= count) break;
      if (!seenUrls.has(pin.imageUrl)) {
        seenUrls.add(pin.imageUrl);
        pins.push(pin);
      }
    }
    console.log(`  DOM fallback found ${domPins.length} images`);
  }

  await browser.close();
  return pins.slice(0, count);
}

async function downloadImage(
  url: string,
  filepath: string
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Referer: "https://www.pinterest.com/",
      },
    });
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();
    // Verify it's actually an image (at least a few KB)
    if (buffer.byteLength < 1024) return false;
    await writeFile(filepath, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

// --- CLI ---
const args = process.argv.slice(2);
const queryIdx = args.indexOf("--query");
const countIdx = args.indexOf("--count");
const categoryIdx = args.indexOf("--category");

const query = queryIdx >= 0 ? args[queryIdx + 1] : null;
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 50;
const category =
  categoryIdx >= 0 ? args[categoryIdx + 1] : "uncategorized";

if (!query) {
  console.error(
    'Usage: bun run scrape.ts --query "search terms" --count 50 --category education'
  );
  process.exit(1);
}

console.log(`\nScraping Pinterest for: "${query}"`);
console.log(`Target: ${count} images -> category: ${category}\n`);

const categoryDir = join(OUTPUT_DIR, category);
if (!existsSync(categoryDir)) {
  await mkdir(categoryDir, { recursive: true });
}

const pins = await scrapePinterest(query, count);
console.log(`\nFound ${pins.length} pins. Downloading...\n`);

let downloaded = 0;
let failed = 0;

for (const pin of pins) {
  const ext = pin.imageUrl.includes(".png") ? "png" : "jpg";
  const filename = `${pin.id}.${ext}`;
  const filepath = join(categoryDir, filename);

  if (existsSync(filepath)) {
    console.log(`  Skip (exists): ${filename}`);
    downloaded++;
    continue;
  }

  const success = await downloadImage(pin.imageUrl, filepath);
  if (success) {
    // Compute content hash after download
    try {
      const fileBuffer = await readFile(filepath);
      pin.content_hash = createHash("sha256").update(fileBuffer).digest("hex");
    } catch {
      // Ignore hash errors
    }
    downloaded++;
    console.log(`  [ok] ${filename} (${downloaded}/${pins.length})`);
  } else {
    failed++;
    console.log(`  [FAIL] ${filename}`);
  }

  // Rate limit: don't hammer Pinterest CDN
  await new Promise((r) => setTimeout(r, 500));
}

// Save metadata alongside images
const metadata = {
  query,
  category,
  scrapedAt: new Date().toISOString(),
  total: pins.length,
  downloaded,
  failed,
  pins: pins.map((p) => ({
    id: p.id,
    filename: `${p.id}.${p.imageUrl.includes(".png") ? "png" : "jpg"}`,
    description: p.description,
    width: p.width,
    height: p.height,
    sourceUrl: p.imageUrl,
    content_hash: p.content_hash || null,
  })),
};

await writeFile(
  join(categoryDir, "_metadata.json"),
  JSON.stringify(metadata, null, 2)
);

console.log(`\nDone! ${downloaded} downloaded, ${failed} failed`);
console.log(`Saved to: ${categoryDir}`);
console.log(`Metadata: ${join(categoryDir, "_metadata.json")}`);
