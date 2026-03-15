import { join } from "path";

// UGC-style queries — targeting phone-taken, candid, TikTok/Instagram slideshow backgrounds
// Key modifiers: "iphone", "pov", "faceless", "that girl", "dark academia", "tiktok", "real"
const NICHES: Record<string, string[]> = {
  // Education
  education: [
    "university aesthetic study desk iphone candid",
    "dark academia library studying real iphone",
    "that girl study session notes coffee iphone faceless",
    "pov studying late night desk lamp iphone",
    "college student dorm room study aesthetic iphone",
  ],
  // Tech / Productivity
  tech: [
    "productivity aesthetic desk setup iphone",
    "pov coding dark room dual monitor iphone real",
    "programmer desk night aesthetic iphone faceless",
    "macbook coffee shop working aesthetic iphone candid",
    "tech setup desk dark aesthetic real iphone",
  ],
  // Fitness - Women
  fitness_women: [
    "sports aesthetic girl workout iphone candid",
    "that girl gym aesthetic iphone faceless real",
    "pilates yoga aesthetic girl iphone candid",
    "running girl morning aesthetic iphone real candid",
    "healthy meal prep aesthetic girl iphone real",
  ],
  // Fitness - Men / Gym
  fitness_gym: [
    "gym men aesthetic workout iphone real candid",
    "working out aesthetic gym dark iphone faceless",
    "pov gym mirror selfie men aesthetic iphone",
    "fitness lifestyle men aesthetic iphone candid real",
    "protein shake gym bag aesthetic iphone real",
  ],
  // Skincare / Beauty
  skincare: [
    "skincare aesthetic iphone candid real routine",
    "skincare aesthetic girl morning routine iphone",
    "pov skincare products bathroom aesthetic iphone",
    "that girl skincare night routine iphone faceless",
    "clean girl aesthetic skincare iphone real candid",
  ],
  // Luxury / Rich lifestyle
  luxury: [
    "lifestyle luxury aesthetic iphone real candid",
    "rich aesthetic apartment morning coffee iphone",
    "luxury car interior aesthetic iphone pov",
    "designer desk setup aesthetic iphone real",
    "that girl luxury lifestyle aesthetic iphone candid",
  ],
  // Business / Entrepreneur
  business: [
    "entrepreneur desk laptop coffee iphone candid real",
    "small business owner packing orders iphone aesthetic",
    "pov working from home laptop iphone faceless",
    "startup office desk aesthetic iphone real candid",
    "freelancer coffee shop working iphone candid real",
  ],
  // Coaching / Self-improvement
  coaching: [
    "journaling morning routine coffee iphone candid",
    "self improvement books desk aesthetic iphone real",
    "pov planning week journal coffee iphone faceless",
    "vision board desk aesthetic iphone real candid",
    "that girl morning routine self care iphone aesthetic",
  ],
  // Ecommerce / Products
  ecommerce: [
    "pov unboxing haul iphone real hands candid",
    "flat lay desk items aesthetic iphone real",
    "small business packaging aesthetic iphone candid",
    "product photography iphone real aesthetic hands",
    "online shopping aesthetic laptop iphone pov candid",
  ],
  // Lifestyle / General
  lifestyle: [
    "pov morning coffee routine aesthetic iphone candid",
    "cozy apartment evening aesthetic iphone real",
    "that girl daily routine aesthetic iphone faceless",
    "cooking dinner aesthetic kitchen iphone real candid",
    "walking city sunset aesthetic iphone pov real",
  ],
  // Food / Restaurant
  food: [
    "aesthetic food photography iphone real candid",
    "brunch aesthetic coffee restaurant iphone pov",
    "cooking aesthetic kitchen real iphone candid",
    "healthy food prep aesthetic iphone real",
    "coffee shop aesthetic latte art iphone candid",
  ],
  // Travel
  travel: [
    "travel aesthetic airport iphone candid real",
    "pov window seat airplane aesthetic iphone",
    "hotel room morning aesthetic iphone real candid",
    "exploring city aesthetic iphone faceless real",
    "beach sunset aesthetic iphone candid real pov",
  ],
  // Finance / Money
  finance: [
    "finance aesthetic desk laptop iphone real candid",
    "budgeting journal coffee aesthetic iphone pov",
    "investing aesthetic laptop charts iphone real",
    "pov working on finances desk aesthetic iphone",
    "money mindset journal aesthetic iphone candid real",
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
