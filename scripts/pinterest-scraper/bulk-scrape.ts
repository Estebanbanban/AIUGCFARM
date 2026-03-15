import { join } from "path";

// Predefined niche queries -- each niche has multiple search terms to get variety
const NICHES: Record<string, string[]> = {
  education: [
    "aesthetic study desk setup",
    "university student studying library",
    "cozy study corner books laptop",
    "education workspace minimal aesthetic",
    "student life aesthetic notebook coffee",
  ],
  business: [
    "startup office workspace aesthetic",
    "entrepreneur desk setup minimal",
    "business meeting coffee shop laptop",
    "corporate workspace modern aesthetic",
    "freelancer home office setup",
  ],
  coaching: [
    "life coaching session aesthetic",
    "personal development books journal",
    "coaching workspace calm aesthetic",
    "mindfulness meditation workspace",
    "goal planning journal aesthetic",
  ],
  fitness: [
    "gym workout aesthetic dark",
    "fitness lifestyle healthy meal prep",
    "running morning workout aesthetic",
    "yoga meditation peaceful aesthetic",
    "athletic lifestyle aesthetic photos",
  ],
  ecommerce: [
    "product photography flat lay aesthetic",
    "online shopping aesthetic lifestyle",
    "package unboxing aesthetic",
    "brand aesthetic lifestyle photography",
    "minimal product display aesthetic",
  ],
  tech: [
    "programmer desk setup dark aesthetic",
    "coding laptop setup aesthetic",
    "tech workspace minimal modern",
    "developer home office dual monitor",
    "software engineer aesthetic workspace",
  ],
  lifestyle: [
    "cozy lifestyle aesthetic apartment",
    "morning routine aesthetic coffee",
    "travel lifestyle aesthetic photos",
    "daily life aesthetic moments",
    "aesthetic faceless content lifestyle",
  ],
};

const IMAGES_PER_QUERY = 30; // 30 images x 5 queries = ~150 images per niche

const selectedNiche = process.argv[2];
const nichesToScrape = selectedNiche
  ? { [selectedNiche]: NICHES[selectedNiche] || [] }
  : NICHES;

if (selectedNiche && !NICHES[selectedNiche]) {
  console.error(`Unknown niche: ${selectedNiche}`);
  console.error(`Available: ${Object.keys(NICHES).join(", ")}`);
  process.exit(1);
}

console.log("Pinterest Bulk Scraper");
console.log(`Niches: ${Object.keys(nichesToScrape).join(", ")}`);
console.log(`Images per query: ${IMAGES_PER_QUERY}\n`);

const scrapeScript = join(import.meta.dir, "scrape.ts");

for (const [niche, queries] of Object.entries(nichesToScrape)) {
  console.log(`\n=== ${niche.toUpperCase()} ===`);

  for (const query of queries) {
    console.log(`\n-> Scraping: "${query}"`);
    try {
      const proc = Bun.spawn(
        [
          "bun",
          "run",
          scrapeScript,
          "--query",
          query,
          "--count",
          String(IMAGES_PER_QUERY),
          "--category",
          niche,
        ],
        {
          cwd: import.meta.dir,
          stdio: ["inherit", "inherit", "inherit"],
        }
      );
      await proc.exited;
    } catch (err) {
      console.error(`  [FAIL] query: ${query}`);
    }

    // Pause between queries to avoid rate limiting
    console.log("  Waiting 5s before next query...");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

console.log("\n\nBulk scrape complete!");
console.log(
  "Run 'bun run upload-to-supabase.ts <admin-user-uuid>' to upload images to CineRads collections."
);
