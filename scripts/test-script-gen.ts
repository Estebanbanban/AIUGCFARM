/**
 * Script Generation Test Harness
 *
 * Tests the UGC script generation prompts against diverse mock products.
 * Runs mechanical analysis + LLM-as-judge evaluation on each output.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... bun scripts/test-script-gen.ts
 *   bun scripts/test-script-gen.ts --product=beauty   # single category
 *   bun scripts/test-script-gen.ts --no-judge          # skip LLM evaluation (faster)
 *
 * Results saved to: scripts/test-results/YYYY-MM-DD-HH-mm.md
 *
 * Keep prompts in sync with: supabase/functions/generate-video/index.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

// ── Config ─────────────────────────────────────────────────────────────

// Load from scripts/.env if present (takes priority over process.env)
const envPath = join(import.meta.dir, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length > 0 && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join("=").trim();
    }
  }
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const args = process.argv.slice(2);
const filterCategory = args.find((a) => a.startsWith("--product="))?.split("=")[1];
const skipJudge = args.includes("--no-judge");

if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY not set");
  process.exit(1);
}

// ── Types ──────────────────────────────────────────────────────────────

interface MockProduct {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  brand_summary: {
    tone: string;
    demographic: string;
    selling_points: string[];
    tagline?: string;
    unique_value_prop?: string;
    customer_pain_points?: string[];
    social_proof?: string;
    price_positioning?: string;
    product_category?: string;
  };
}

interface Segment {
  text: string;
  duration_seconds: number;
  variant_label: string;
}

interface GeneratedScript {
  hooks: Segment[];
  bodies: Segment[];
  ctas: Segment[];
}

interface JudgeResult {
  score: number;
  ai_tells: string[];
  invented_stats: string[];
  casual_language: "natural" | "forced" | "absent";
  suggestion: string;
}

interface MechanicalResult {
  banned_words: string[];
  casual_words_found: string[];
  has_personal_specificity: boolean;
  has_invented_stats: boolean;
  total_duration: number;
  under_20s: boolean;
}

// ── Mock Products ──────────────────────────────────────────────────────

const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "beauty",
    category: "skincare",
    name: "Glow Serum C+",
    description: "Vitamin C serum with 15% L-ascorbic acid, hyaluronic acid, and vitamin E. Brightens skin tone, reduces dark spots, and protects against environmental damage.",
    price: 45,
    currency: "USD",
    brand_summary: {
      tone: "clean, approachable",
      demographic: "women 25-40 interested in skincare",
      selling_points: ["15% vitamin C concentration", "doesn't oxidize", "fragrance-free"],
      tagline: "Glow from within",
      customer_pain_points: ["uneven skin tone", "expensive serums that don't work", "products that oxidize quickly"],
      price_positioning: "mid-range, significantly cheaper than luxury alternatives",
      product_category: "skincare",
    },
  },
  {
    id: "fitness",
    category: "fitness supplement",
    name: "Clean Whey Pro",
    description: "Grass-fed whey protein isolate. 25g protein per serving, no artificial sweeteners, mixes clean. Chocolate and vanilla flavors.",
    price: 55,
    currency: "USD",
    brand_summary: {
      tone: "no-nonsense, performance-first",
      demographic: "fitness enthusiasts 22-35 who care about clean ingredients",
      selling_points: ["25g protein per serving", "grass-fed", "no artificial sweeteners", "mixes without clumps"],
      customer_pain_points: ["protein powders that taste chalky", "hidden sweeteners", "foamy texture"],
      price_positioning: "premium but justified by ingredient quality",
      product_category: "fitness supplement",
    },
  },
  {
    id: "fashion",
    category: "footwear",
    name: "Stride Runner 2",
    description: "Minimalist running shoe with responsive foam midsole. Lightweight at 8.2oz, wide toe box, suitable for road and light trail.",
    price: 120,
    currency: "USD",
    brand_summary: {
      tone: "understated, quality-focused",
      demographic: "casual runners and everyday wearers 25-40",
      selling_points: ["8.2oz lightweight", "wide toe box", "responsive foam", "works for running and daily wear"],
      customer_pain_points: ["bulky running shoes", "narrow toe boxes causing pain", "shoes that look too athletic"],
      price_positioning: "mid-range, comparable to Nike/Adidas but better fit",
      product_category: "footwear",
    },
  },
  {
    id: "saas",
    category: "productivity app",
    name: "Focusly",
    description: "AI-powered focus timer that blocks distractions, auto-schedules deep work blocks based on your calendar, and tracks daily output. Integrates with Notion and Slack.",
    price: 12,
    currency: "USD",
    brand_summary: {
      tone: "calm, productivity-focused",
      demographic: "knowledge workers and freelancers 25-45 who struggle with focus",
      selling_points: ["AI schedules your focus blocks", "blocks distractions automatically", "Notion + Slack integration", "$12/month"],
      customer_pain_points: ["fragmented work day", "constant Slack interruptions", "procrastination on deep work"],
      price_positioning: "less than a coffee per week",
      product_category: "productivity app",
      unique_value_prop: "The only focus app that actually reads your calendar and schedules your deep work for you",
    },
  },
  {
    id: "food",
    category: "food & beverage",
    name: "Ceremonial Matcha Starter Kit",
    description: "30g ceremonial-grade matcha from Uji, Japan. Stone-ground, no additives. Includes bamboo whisk. Produces smooth, non-bitter matcha with natural sweetness.",
    price: 28,
    currency: "USD",
    brand_summary: {
      tone: "calm, ritual-focused",
      demographic: "coffee drinkers looking for an alternative, wellness-interested 22-40",
      selling_points: ["ceremonial grade from Uji", "includes bamboo whisk", "smooth non-bitter taste", "no additives"],
      customer_pain_points: ["bitter matcha from coffee shops", "caffeine crashes from coffee", "overpriced lattes"],
      price_positioning: "one kit replaces 14+ $6 matcha lattes",
      product_category: "food & beverage",
    },
  },
  {
    id: "home",
    category: "home appliance",
    name: "PureAir Mini",
    description: "Compact HEPA air purifier for rooms up to 200 sq ft. Removes 99.97% of particles 0.3 microns+. Near-silent at 25dB on low. Filter replacement every 6 months.",
    price: 79,
    currency: "USD",
    brand_summary: {
      tone: "practical, health-focused",
      demographic: "allergy sufferers, parents, urban apartment dwellers 25-45",
      selling_points: ["HEPA filter 99.97%", "25dB near-silent", "200 sq ft coverage", "runs 6 months per filter"],
      customer_pain_points: ["allergies and dust", "loud white noise machines", "expensive air purifiers"],
      price_positioning: "half the price of Dyson or Levoit, same HEPA standard",
      product_category: "home appliance",
    },
  },
];

// ── Prompt Builders ────────────────────────────────────────────────────
// Keep in sync with: supabase/functions/generate-video/index.ts

function buildSystemPrompt(hooksCount: number, bodiesCount: number, ctasCount: number): string {
  const hookAngles = hooksCount > 1
    ? " Each uses a DIFFERENT angle from the SGE framework below."
    : " Use the BEST angle from the SGE framework below for this product.";
  const bodyAngles = bodiesCount > 1
    ? " Each uses a DIFFERENT structure."
    : " Use whichever structure fits best.";
  const ctaAngles = ctasCount > 1
    ? " Each uses a DIFFERENT invisible-CTA pattern."
    : " Use the most natural-sounding invisible-CTA pattern.";

  return `You are a real person talking to your phone camera, telling a friend about something you recently started using. You are NOT a copywriter. You are NOT writing an ad. You're just recounting what happened.

Pick the character voice that fits this product and demographic — stay in it throughout:
- The skeptic who was proven wrong ("I genuinely didn't think this would work for me")
- The accidental discoverer ("I wasn't even looking for this, someone mentioned it offhand")
- The person who wasted time/money before this ("I wish I'd found this two years ago, honestly")
- The quiet recommender ("I don't usually post about stuff but three people asked me this week")
- The convert ("I was using [similar thing] for years before I switched — not going back")

Your job: recount the experience. Don't sell, don't convince. Hook + body + CTA should total under 20 seconds — lean shorter.

VOICE RULES:
- Use casual human connectors: "lowkey", "honestly", "kind of", "I mean", "like", "tbh", "ngl", "actually"
- Short clipped sentences work: "It just works." / "Three weeks in." / "Not gonna lie."
- Start mid-thought sometimes: "Took me a week to believe it." / "Been using it daily since."
- Contractions always: "I've", "it's", "wasn't", "I'd", "I'm"
- NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have" — instant AI tells
- No emojis
- ~2.5 words per second. Set duration_seconds based on actual word count.

SPECIFICITY RULE: Personal measurements only — never invented statistics.
- BAD: "87% of users saw results" ← a real person would never say this
- GOOD: "I timed myself the first week" / "third time using it" / "been using it since January"
- BAD: "long-lasting" | GOOD: "I wore it all day and it held"
- BAD: "affordable" | GOOD: "$12, which honestly surprised me"

---

HOOK — ${hooksCount} variant${hooksCount > 1 ? "s" : ""} | 2–4 seconds each${hookAngles}
Stop the scroll in the first 2 seconds. Max 2 sentences. No setup.

Hook angles to draw from — pick what fits the product and character naturally:
- LATE_DISCOVERY: "I've been [doing it the wrong way] for [time] and then I found this"
- PRICE_SHOCK: Lead with the price before saying what it is — works when the number surprises
- SPECIFICITY_LEAD: Open with a concrete personal detail — a timeframe, a moment, a measurement
- EVERYONE_KNOWS_BUT_YOU: "Everyone in [niche] already knows about this" — tribal curiosity

---

BODY — ${bodiesCount} variant${bodiesCount > 1 ? "s" : ""} | 5–9 seconds each | 12–22 words max${bodyAngles}
Continue from the hook — don't restate the problem. Jump to what happened.
At 2.5 words/sec: 5s ≈ 12 words, 7s ≈ 17 words, 9s ≈ 22 words. Stay within limits.

CRITICAL BODY RULES:
- Do NOT restate or echo the hook's opening
- Deliver proof, a specific observation, or what changed
- One personal specific: a timeframe, a named feature, something you noticed

Body shapes to draw from:
- problem_solution: the issue was [X], this [did Y] in [timeframe], here's what changed
- demo_tease: describe what you'd actually experience — specific sensory detail
- story_beat: one vivid moment, present-tense feel
- social_proof_stack: [X weeks/uses later] — here's where things actually landed

---

CTA — ${ctasCount} variant${ctasCount > 1 ? "s" : ""} | 2–4 seconds each | 5–10 words max${ctaAngles}

INVISIBLE CTA RULE: No "link in bio", "shop now", "buy now". End the conversation naturally — the way you'd sign off talking to a friend.

CTA approaches:
- Leave them wanting: "I'll let you find it yourself." / "You'll know it when you see it."
- Soft qualifier: "Not for everyone — but if you're dealing with [thing], worth a look."
- Understated sign-off: "Anyway. Look it up." / "That's kind of all I've got."
- Accidental recommendation: "I wasn't even planning on mentioning this but here we are."
- Social signal: "Half my [group] is using it now. Make of that what you will."

---

Return ONLY valid JSON (exactly ${hooksCount} hooks, ${bodiesCount} bodies, ${ctasCount} CTAs). Set duration_seconds to match actual word count at 2.5 words/sec:
{
  "hooks": [{ "text": "...", "duration_seconds": 3, "variant_label": "LATE_DISCOVERY" }${hooksCount > 1 ? ", ..." : ""}],
  "bodies": [{ "text": "...", "duration_seconds": 7, "variant_label": "problem_solution" }${bodiesCount > 1 ? ", ..." : ""}],
  "ctas": [{ "text": "...", "duration_seconds": 3, "variant_label": "soft_recommendation" }${ctasCount > 1 ? ", ..." : ""}]
}`;
}

function buildUserPrompt(product: MockProduct): string {
  const bs = product.brand_summary;
  const sellingPoints = bs.selling_points.join(", ");

  const optionalLines: string[] = [];
  if (bs.tagline) optionalLines.push(`Brand tagline: ${bs.tagline}`);
  if (bs.social_proof) optionalLines.push(`Social proof: ${bs.social_proof}`);
  if (bs.price_positioning) optionalLines.push(`Price positioning: ${bs.price_positioning}`);
  const optionalBlock = optionalLines.length > 0 ? "\n" + optionalLines.join("\n") : "";

  return `Product: ${product.name}
Description: ${product.description}
Price: ${product.price} ${product.currency}
Brand tone: ${bs.tone}
Target demographic: ${bs.demographic}
Key selling points: ${sellingPoints}${optionalBlock}
${bs.unique_value_prop ? `Unique value proposition: ${bs.unique_value_prop}` : ""}
${bs.customer_pain_points ? `Target these pain points: ${bs.customer_pain_points.join(", ")}` : ""}

PRICE NOTE: The product costs ${product.price} ${product.currency}. Do NOT use "just $X" or "only $X" unless clearly budget-friendly.

SPECIFICITY: Use personal measurements — not invented stats. "I timed it", "third week using it". Never "87% of users" or "most people".

- Mirror the brand tone naturally.
- CTA must be invisible — no "link in bio", no "shop now", no "buy now".`;
}

// ── OpenRouter Caller ──────────────────────────────────────────────────

async function callOpenRouter(
  messages: { role: "system" | "user"; content: string }[],
  opts: { maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://aiugcgenerator.com",
      "X-Title": "AI UGC Generator - Test Harness",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 800,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const body = await res.json() as { choices: { message: { content: string } }[] };
  return body.choices[0].message.content;
}

// ── Mechanical Analysis ────────────────────────────────────────────────

const BANNED_WORDS = ["game-changer", "amazing", "incredible", "life-changing", "must-have", "life changing", "game changer"];
const CASUAL_WORDS = ["lowkey", "honestly", "kind of", "i mean", "tbh", "ngl", "actually", "like,", "not gonna lie", "i wasn't", "i wasn't even", "i've been", "i'd", "i'm", "three weeks", "two weeks", "a week", "been using", "took me"];
const INVENTED_STATS = [/\d+%\s+of\s+(users|people|customers)/i, /most\s+(users|people|customers)\s+see/i, /\d+\s+out\s+of\s+\d+/i];

function mechanicalCheck(hook: Segment, body: Segment, cta: Segment): MechanicalResult {
  const fullText = [hook.text, body.text, cta.text].join(" ").toLowerCase();
  const totalDuration = hook.duration_seconds + body.duration_seconds + cta.duration_seconds;

  return {
    banned_words: BANNED_WORDS.filter((w) => fullText.includes(w)),
    casual_words_found: CASUAL_WORDS.filter((w) => fullText.includes(w)),
    has_personal_specificity: /\b(week|month|day|year|timed|counted|since january|since february|since march|first use|third use|second week|daily|morning|night)\b/i.test(fullText),
    has_invented_stats: INVENTED_STATS.some((r) => r.test(fullText)),
    total_duration: totalDuration,
    under_20s: totalDuration <= 20,
  };
}

// ── LLM Judge ─────────────────────────────────────────────────────────

async function judgeScript(hook: Segment, body: Segment, cta: Segment): Promise<JudgeResult> {
  const script = `HOOK: "${hook.text}"\nBODY: "${body.text}"\nCTA: "${cta.text}"`;

  const raw = await callOpenRouter(
    [
      {
        role: "system",
        content: `You are evaluating UGC ad scripts for authenticity. Rate how much this sounds like a real person talking to camera vs. an AI-generated ad.

Score 1 = obviously AI-written marketing copy
Score 10 = sounds exactly like a real person sharing a genuine discovery

Return ONLY valid JSON:
{
  "score": <1-10>,
  "ai_tells": ["phrase that sounds fake", ...],
  "invented_stats": ["any invented stats found", ...],
  "casual_language": "natural" | "forced" | "absent",
  "suggestion": "one specific improvement"
}`,
      },
      { role: "user", content: script },
    ],
    { maxTokens: 300, json: true },
  );

  return JSON.parse(raw) as JudgeResult;
}

// ── Report Builder ─────────────────────────────────────────────────────

function scoreEmoji(score: number): string {
  if (score >= 8) return "🟢";
  if (score >= 6) return "🟡";
  return "🔴";
}

function mechanicalEmoji(pass: boolean): string {
  return pass ? "✅" : "❌";
}

function formatReport(
  results: Array<{
    product: MockProduct;
    script: GeneratedScript;
    combos: Array<{ hook: Segment; body: Segment; cta: Segment; mechanical: MechanicalResult; judge?: JudgeResult }>;
  }>,
  durationMs: number,
): string {
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").slice(0, 19);

  const allScores = results.flatMap((r) =>
    r.combos.map((c) => c.judge?.score ?? 0).filter((s) => s > 0),
  );
  const avgScore = allScores.length > 0
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : "N/A";

  const allMechanical = results.flatMap((r) => r.combos.map((c) => c.mechanical));
  const bannedWordHits = allMechanical.filter((m) => m.banned_words.length > 0).length;
  const inventedStatHits = allMechanical.filter((m) => m.has_invented_stats).length;
  const over20sHits = allMechanical.filter((m) => !m.under_20s).length;

  let md = `# Script Generation Test Results

**Date:** ${dateStr}
**Model:** ${MODEL}
**Products tested:** ${results.length}
**Avg authenticity score:** ${avgScore}/10
**Duration:** ${(durationMs / 1000).toFixed(1)}s

## Summary

| Check | Result |
|-------|--------|
| Banned words detected | ${bannedWordHits === 0 ? "✅ 0 hits" : `❌ ${bannedWordHits} combos affected`} |
| Invented stats detected | ${inventedStatHits === 0 ? "✅ 0 hits" : `❌ ${inventedStatHits} combos affected`} |
| Scripts over 20s | ${over20sHits === 0 ? "✅ All under 20s" : `⚠️ ${over20sHits} over 20s`} |

---

`;

  for (const { product, script, combos } of results) {
    md += `## ${product.name} (${product.category}, $${product.price})\n\n`;

    md += `### Generated Segments\n\n`;
    md += `**Hooks:**\n`;
    for (const h of script.hooks) {
      md += `- \`${h.variant_label}\` [${h.duration_seconds}s] "${h.text}"\n`;
    }
    md += `\n**Bodies:**\n`;
    for (const b of script.bodies) {
      md += `- \`${b.variant_label}\` [${b.duration_seconds}s] "${b.text}"\n`;
    }
    md += `\n**CTAs:**\n`;
    for (const c of script.ctas) {
      md += `- \`${c.variant_label}\` [${c.duration_seconds}s] "${c.text}"\n`;
    }
    md += `\n`;

    md += `### Combo Analysis\n\n`;
    combos.forEach((combo, i) => {
      const { hook, body, cta, mechanical, judge } = combo;
      const totalDur = mechanical.total_duration;

      md += `#### Combo ${i + 1} — ${hook.variant_label} + ${body.variant_label} + ${cta.variant_label}\n\n`;
      md += `> **Hook:** ${hook.text}\n>\n`;
      md += `> **Body:** ${body.text}\n>\n`;
      md += `> **CTA:** ${cta.text}\n\n`;

      if (judge) {
        md += `${scoreEmoji(judge.score)} **Authenticity: ${judge.score}/10**\n\n`;
      }

      md += `**Mechanical:** `;
      md += `${mechanicalEmoji(mechanical.banned_words.length === 0)} banned words`;
      if (mechanical.banned_words.length > 0) md += ` (${mechanical.banned_words.join(", ")})`;
      md += ` | ${mechanicalEmoji(!mechanical.has_invented_stats)} invented stats`;
      md += ` | ${mechanicalEmoji(mechanical.under_20s)} total ${totalDur}s`;
      md += ` | casual: [${mechanical.casual_words_found.slice(0, 3).join(", ") || "none"}]\n\n`;

      if (judge) {
        if (judge.ai_tells.length > 0) {
          md += `**AI tells:** ${judge.ai_tells.join(", ")}\n\n`;
        }
        if (judge.invented_stats.length > 0) {
          md += `**Invented stats:** ${judge.invented_stats.join(", ")}\n\n`;
        }
        md += `**Casual language:** ${judge.casual_language}\n\n`;
        md += `**Suggestion:** ${judge.suggestion}\n\n`;
      }

      md += `---\n\n`;
    });
  }

  return md;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const products = filterCategory
    ? MOCK_PRODUCTS.filter((p) => p.id === filterCategory || p.category.includes(filterCategory))
    : MOCK_PRODUCTS;

  if (products.length === 0) {
    console.error(`❌ No products found for filter: ${filterCategory}`);
    console.error(`Available: ${MOCK_PRODUCTS.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🧪 Script Generation Test Harness`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Products: ${products.map((p) => p.id).join(", ")}`);
  console.log(`   Judge: ${skipJudge ? "disabled" : "enabled"}`);
  console.log(`   Generating...\n`);

  const startTime = Date.now();
  const results = [];

  for (const product of products) {
    process.stdout.write(`   ▸ ${product.name}... `);

    // Generate scripts
    const raw = await callOpenRouter(
      [
        { role: "system", content: buildSystemPrompt(3, 3, 3) },
        { role: "user", content: buildUserPrompt(product) },
      ],
      { maxTokens: 1000, json: true },
    );

    let script: GeneratedScript;
    try {
      script = JSON.parse(raw) as GeneratedScript;
    } catch {
      console.error(`\n   ❌ Failed to parse JSON for ${product.name}`);
      console.error(raw.slice(0, 200));
      continue;
    }

    // Build combos (variant 0-0-0, 1-1-1, 2-2-2)
    const combos = [];
    for (let i = 0; i < 3; i++) {
      const hook = script.hooks[i] ?? script.hooks[0];
      const body = script.bodies[i] ?? script.bodies[0];
      const cta = script.ctas[i] ?? script.ctas[0];
      const mechanical = mechanicalCheck(hook, body, cta);

      let judge: JudgeResult | undefined;
      if (!skipJudge) {
        judge = await judgeScript(hook, body, cta);
      }

      combos.push({ hook, body, cta, mechanical, judge });
    }

    const avgJudge = combos
      .map((c) => c.judge?.score ?? 0)
      .filter((s) => s > 0)
      .reduce((a, b, _, arr) => a + b / arr.length, 0);

    const judgeStr = skipJudge ? "" : ` | judge avg: ${avgJudge.toFixed(1)}/10`;
    console.log(`done${judgeStr}`);

    results.push({ product, script, combos });
  }

  const durationMs = Date.now() - startTime;
  const report = formatReport(results, durationMs);

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const outDir = join(import.meta.dir, "test-results");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${timestamp}.md`);
  writeFileSync(outPath, report);

  console.log(`\n✅ Done in ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`📄 Report: scripts/test-results/${timestamp}.md\n`);

  // Print quick summary to stdout
  const avgScore = results
    .flatMap((r) => r.combos.map((c) => c.judge?.score ?? 0))
    .filter((s) => s > 0)
    .reduce((a, b, _, arr) => (arr.length > 0 ? a + b / arr.length : 0), 0);

  if (!skipJudge) {
    console.log(`   Overall avg score: ${avgScore.toFixed(1)}/10`);
  }

  const allMechanical = results.flatMap((r) => r.combos.map((c) => c.mechanical));
  const issues = [
    allMechanical.filter((m) => m.banned_words.length > 0).length > 0 && "⚠️  Banned words detected",
    allMechanical.filter((m) => m.has_invented_stats).length > 0 && "⚠️  Invented stats detected",
    allMechanical.filter((m) => !m.under_20s).length > 0 && "⚠️  Scripts over 20s",
  ].filter(Boolean);

  if (issues.length === 0) {
    console.log("   ✅ All mechanical checks passed\n");
  } else {
    issues.forEach((i) => console.log(`   ${i}`));
    console.log();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
