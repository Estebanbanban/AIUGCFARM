import { join } from "path";

// UGC-style queries — targeting phone-taken, candid, TikTok/Instagram slideshow backgrounds
// Key modifiers: "iphone", "pov", "faceless", "that girl", "dark academia", "tiktok", "real"
const NICHES: Record<string, string[]> = {
  education: [
    "pov studying at night dark academia iphone",
    "messy desk studying tiktok faceless iphone photo",
    "that girl study session coffee laptop iphone candid",
    "dark academia library studying aesthetic tiktok",
    "faceless study desk notes coffee real iphone pov",
  ],
  business: [
    "pov working laptop coffee shop iphone candid faceless",
    "faceless typing laptop desk real iphone photo",
    "that girl work from home aesthetic tiktok iphone",
    "pov hands laptop morning coffee work iphone",
    "messy desk working late night laptop iphone faceless",
  ],
  coaching: [
    "pov journaling morning coffee iphone candid real",
    "that girl self care morning routine iphone aesthetic",
    "faceless journal planning desk coffee iphone pov",
    "pov reading self help book coffee cozy iphone",
    "dark feminine journal candle desk aesthetic iphone faceless",
  ],
  fitness: [
    "pov gym mirror selfie aesthetic iphone real",
    "faceless gym workout tiktok aesthetic iphone",
    "that girl healthy meal prep real iphone photo",
    "pov running morning sunrise iphone candid real",
    "faceless yoga mat morning routine iphone aesthetic",
  ],
  ecommerce: [
    "pov unboxing haul iphone candid real hands",
    "faceless hands holding product iphone real aesthetic",
    "that girl shopping haul aesthetic tiktok iphone",
    "pov desk flat lay items real iphone photo candid",
    "faceless packaging small business iphone real aesthetic",
  ],
  tech: [
    "pov coding at night dark desk iphone real faceless",
    "faceless programmer laptop dual screen iphone dark aesthetic",
    "messy desk developer late night iphone real candid",
    "pov hands typing code laptop dark iphone",
    "that girl tech setup aesthetic iphone faceless desk",
  ],
  lifestyle: [
    "pov morning coffee routine iphone candid real faceless",
    "that girl apartment aesthetic tiktok iphone real",
    "faceless cozy night in bed iphone candid aesthetic",
    "pov cooking dinner aesthetic iphone real candid",
    "faceless walking city sunset iphone real aesthetic tiktok",
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

console.log("Pinterest Bulk Scraper (UGC-style queries)");
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
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        console.log(`  [WARN] Scrape exited with code ${exitCode}`);
      }
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
  "Run 'bun run filter-images.ts' to AI-filter non-UGC images."
);
console.log(
  "Run 'bun run upload-to-supabase.ts <admin-user-uuid>' to upload to CineRads."
);
