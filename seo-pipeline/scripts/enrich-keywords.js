/**
 * enrich-keywords.js
 * Collects real long-tail target keywords from article-queue.json + opportunity pipeline,
 * then hits DataForSEO Labs for organic search volume, search intent, CPC, and keyword difficulty.
 *
 * Uses two DataForSEO endpoints:
 *   1. dataforseo_labs/google/keyword_overview/live  — organic volume, intent, CPC, competition
 *   2. dataforseo_labs/google/bulk_keyword_difficulty/live — KD score (0-100)
 *
 * Writes to seo-pipeline/keyword-data.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, '..');

config({ path: join(PIPELINE_DIR, '.env') });

const ARTICLE_QUEUE_PATH = join(PIPELINE_DIR, 'article-queue.json');
const OPPORTUNITIES_PATH = join(PIPELINE_DIR, 'opportunity-priority.json');
const OUTPUT_PATH = join(PIPELINE_DIR, 'keyword-data.json');

const DATAFORSEO_AUTH = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

const LOCATION_CODE = 2840; // United States
const LANGUAGE_CODE = 'en';
const BATCH_SIZE = 700;

// Words to strip when generating a short seed keyword from a long-tail phrase.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'for', 'to', 'vs', 'how', 'guide', 'strategy',
  'tutorial', 'best', 'practices', 'complete', 'example', 'examples', 'template',
  'comparison', 'that', 'with', 'from', '2026', '2025', '2024', 'and', 'or', 'of',
  'what', 'why', 'when', 'where', 'which', 'difference', 'between', 'using',
]);

// Extract a 2-3 word seed from a long-tail keyword phrase.
// E.g. "tiktok creative center guide 2026" -> "tiktok creative center"
//      "ai ugc vs human creators"          -> "ai ugc creators"
function extractSeed(phrase) {
  const words = phrase
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return words.slice(0, 3).join(' ');
}

async function dfsPost(endpoint, payload) {
  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${DATAFORSEO_AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DataForSEO /${endpoint} ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO /${endpoint} error: ${task?.status_message || 'unknown'} (${task?.status_code})`);
  }
  return json;
}

async function enrichKeywords() {
  console.log('Enriching keywords with DataForSEO Labs...');

  const allKeywords = new Map(); // keyword (lowercase) -> { slug, source }

  // 1. Primary keywords from article-queue.json (the actual long-tail phrases we target)
  const queue = JSON.parse(readFileSync(ARTICLE_QUEUE_PATH, 'utf-8'));
  for (const article of queue.articles || []) {
    for (const kw of article.primary_keywords || []) {
      const k = kw.toLowerCase().trim();
      if (k && !allKeywords.has(k)) {
        allKeywords.set(k, { slug: article.slug, source: 'article_queue' });
      }
    }
  }

  // 2. Keywords from opportunity pipeline (planned articles)
  const opps = JSON.parse(readFileSync(OPPORTUNITIES_PATH, 'utf-8'));
  for (const opp of opps.topActions || []) {
    const k = opp.keyword.toLowerCase().trim();
    if (k && !allKeywords.has(k)) {
      allKeywords.set(k, { slug: opp.slug, source: 'opportunity_pipeline' });
    }
  }

  const keywordList = Array.from(allKeywords.keys());
  console.log(`  Keywords to enrich: ${keywordList.length}`);

  // Build seed keywords for each long-tail phrase and include them in the lookup.
  // seedMap: seed phrase -> original keyword it was derived from
  const seedToOriginal = new Map();
  const seedsToLookup = new Set();
  for (const kw of keywordList) {
    const seed = extractSeed(kw);
    if (seed && seed !== kw && seed.split(' ').length >= 2) {
      seedsToLookup.add(seed);
      if (!seedToOriginal.has(seed)) seedToOriginal.set(seed, kw);
    }
  }

  // Full lookup list: original keywords + unique seeds
  const lookupList = [...new Set([...keywordList, ...seedsToLookup])];
  console.log(`  Lookup list (incl. seeds): ${lookupList.length}`);

  const overviewMap = new Map();  // keyword -> { searchVolume, cpc, competition, intent, monthlySearches }
  const difficultyMap = new Map(); // keyword -> keywordDifficulty (0-100)

  for (let i = 0; i < lookupList.length; i += BATCH_SIZE) {
    const batch = lookupList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // --- Keyword Overview: organic volume + intent + CPC ---
    try {
      const data = await dfsPost('dataforseo_labs/google/keyword_overview/live', [
        {
          keywords: batch,
          location_code: LOCATION_CODE,
          language_code: LANGUAGE_CODE,
        },
      ]);

      const items = data.tasks?.[0]?.result?.[0]?.items || [];
      for (const item of items) {
        const info = item.keyword_info || {};
        const intent = item.search_intent_info || {};
        overviewMap.set(item.keyword?.toLowerCase(), {
          searchVolume: info.search_volume ?? null,
          cpc: info.cpc ?? null,
          competition: info.competition ?? null,
          competitionLevel: info.competition_level ?? null,
          intent: intent.main_intent ?? null,
          secondaryIntents: intent.foreign_intent ?? [],
          monthlySearches: (info.monthly_searches || []).slice(-12),
        });
      }
      console.log(`  Overview batch ${batchNum}: ${items.length} results`);
    } catch (err) {
      console.warn(`  Overview batch ${batchNum} error: ${err.message}`);
    }

    // --- Bulk Keyword Difficulty ---
    try {
      const data = await dfsPost('dataforseo_labs/google/bulk_keyword_difficulty/live', [
        {
          keywords: batch,
          location_code: LOCATION_CODE,
          language_code: LANGUAGE_CODE,
        },
      ]);

      const items = data.tasks?.[0]?.result?.[0]?.items || [];
      for (const item of items) {
        if (item.keyword != null) {
          difficultyMap.set(item.keyword.toLowerCase(), item.keyword_difficulty ?? null);
        }
      }
      console.log(`  Difficulty batch ${batchNum}: ${items.length} results`);
    } catch (err) {
      console.warn(`  Difficulty batch ${batchNum} error: ${err.message}`);
    }
  }

  // 3. Merge — fall back to seed keyword volume when exact phrase has no data
  const enriched = [];
  for (const [keyword, meta] of allKeywords) {
    const ov = overviewMap.get(keyword) || {};
    const kd = difficultyMap.get(keyword) ?? null;

    // If exact keyword has no volume, try its seed
    const seed = extractSeed(keyword);
    const seedOv = (!ov.searchVolume && seed && seed !== keyword)
      ? (overviewMap.get(seed) || {})
      : {};

    const effectiveVolume = ov.searchVolume ?? seedOv.searchVolume ?? null;
    const effectiveOv = effectiveVolume === seedOv.searchVolume && !ov.searchVolume ? seedOv : ov;
    const volumeSource = ov.searchVolume ? 'exact' : (seedOv.searchVolume ? `seed:${seed}` : null);

    enriched.push({
      keyword,
      slug: meta.slug,
      source: meta.source,
      searchVolume: effectiveVolume,
      volumeSource,
      keywordDifficulty: kd,
      intent: effectiveOv.intent ?? null,
      secondaryIntents: effectiveOv.secondaryIntents ?? [],
      competition: effectiveOv.competition ?? null,
      competitionLevel: effectiveOv.competitionLevel ?? null,
      cpc: effectiveOv.cpc ?? null,
      monthlySearches: effectiveOv.monthlySearches ?? [],
    });
  }

  enriched.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));

  const output = {
    version: '2.0',
    note: 'Auto-generated by enrich-keywords.js. Do not edit manually.',
    updatedAt: new Date().toISOString(),
    totalKeywords: enriched.length,
    keywords: enriched,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Written to keyword-data.json (${enriched.length} keywords)`);

  return output;
}

enrichKeywords().catch((err) => {
  console.error('enrich-keywords failed:', err.message);
  process.exit(1);
});
