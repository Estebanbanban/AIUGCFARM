import { join } from "path";

// Predefined niche queries -- each niche has multiple search terms to get variety
const NICHES: Record<string, string[]> = {
  education: [
    "pov studying at my desk laptop coffee candid",
    "messy study desk real student life aesthetic",
    "that girl studying library candid faceless",
    "day in my life student study session real",
    "candid hands writing notebook laptop study",
  ],
  business: [
    "pov working from cafe laptop candid real",
    "messy desk entrepreneur real workspace",
    "faceless working from home laptop candid",
    "day in my life remote work aesthetic real",
    "candid hands laptop coffee shop working",
  ],
  coaching: [
    "journaling morning routine candid real",
    "personal growth books coffee real photo",
    "pov planning my week journal candid",
    "that girl morning routine self care real",
    "candid hands journal planner coffee aesthetic",
  ],
  fitness: [
    "pov gym workout candid real aesthetic",
    "day in my life healthy lifestyle real",
    "candid workout gym selfie mirror real",
    "meal prep real kitchen candid aesthetic",
    "morning run candid real athletic aesthetic",
  ],
  ecommerce: [
    "pov unboxing package candid hands real",
    "aesthetic flat lay real desk items candid",
    "candid hands holding product real lifestyle",
    "day in my life small business owner real",
    "pov online shopping laptop coffee candid",
  ],
  tech: [
    "pov coding at night dark desk real candid",
    "messy programmer desk dual monitor real",
    "day in my life software developer real",
    "candid hands typing laptop code dark",
    "faceless developer workspace real aesthetic",
  ],
  lifestyle: [
    "pov morning coffee routine candid real",
    "that girl aesthetic apartment real candid",
    "day in my life candid faceless real moments",
    "candid cozy evening reading real photo",
    "pov hands coffee book cozy candid real",
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
