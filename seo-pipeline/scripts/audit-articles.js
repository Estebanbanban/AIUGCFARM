/**
 * audit-articles.js
 * Cross-references every existing .mdx article with real GSC ranking data
 * and DataForSEO keyword volume/difficulty. Produces article-audit.json:
 *   - Per-article: current position, impressions, clicks, target keyword stats, gap score
 *   - Keyword gaps: high-volume keywords from the opportunity pipeline with no article yet
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import matter from 'gray-matter';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, '..');

config({ path: join(PIPELINE_DIR, '.env') });

const BLOG_DIR = resolve(PIPELINE_DIR, '..', 'frontend', 'src', 'content', 'blog');
const GSC_PATH = join(PIPELINE_DIR, 'gsc-data.json');
const KEYWORD_PATH = join(PIPELINE_DIR, 'keyword-data.json');
const OPPORTUNITIES_PATH = join(PIPELINE_DIR, 'opportunity-priority.json');
const ARTICLE_QUEUE_PATH = join(PIPELINE_DIR, 'article-queue.json');
const OUTPUT_PATH = join(PIPELINE_DIR, 'article-audit.json');

const BASE_URL = (process.env.BLOG_BASE_URL || 'https://www.cinerads.com').replace(/\/$/, '');

// Gap score: how much ranking opportunity exists for this article.
// High volume + poor/no ranking = high gap score = high priority.
function computeGapScore(searchVolume, position, clicks) {
  if (!searchVolume || searchVolume === 0) return 0;
  // Position factor: not ranking = 1.0 (max gap), position 1 = 0.01 (already there), position 50 = 0.5
  const posFactor = position ? Math.min(position / 100, 1.0) : 1.0;
  // Click bonus: existing clicks mean the page is being found, slight reward
  const clickBonus = clicks ? Math.log1p(clicks) * 0.05 : 0;
  return Math.round(searchVolume * posFactor * (1 + clickBonus));
}

function getRankStatus(position) {
  if (!position) return 'not_ranking';
  if (position <= 3) return 'top_3';
  if (position <= 10) return 'page_1';
  if (position <= 20) return 'page_2';
  return 'page_3_plus';
}

function getOpportunityLevel(searchVolume, position, difficulty) {
  if (!searchVolume) return 'no_data';
  const kd = difficulty ?? 100;
  const pos = position ?? 999;
  if (searchVolume >= 5000 && pos > 10 && kd < 60) return 'high';
  if (searchVolume >= 1000 && pos > 10 && kd < 75) return 'medium';
  if (pos <= 10 && searchVolume >= 500) return 'optimize_ctr';
  if (searchVolume >= 500 && pos > 10) return 'low_medium';
  return 'low';
}

function generateNotes(article) {
  const notes = [];
  const { gsc, keyword, topQueries } = article;

  if (!gsc.position) {
    if (keyword.searchVolume && keyword.searchVolume >= 1000) {
      notes.push(
        `Not ranking yet — ${keyword.searchVolume.toLocaleString()}/mo search volume at stake. Strengthen on-page optimization, internal links, and E-E-A-T signals.`
      );
    } else {
      notes.push('Not ranking yet. Check indexing, internal links, and on-page keyword targeting.');
    }
  } else if (gsc.position >= 11 && gsc.position <= 20) {
    notes.push(
      `Ranking page 2 (position ${gsc.position}) — strong optimization candidate. Improving to page 1 could unlock ${Math.round((keyword.searchVolume || 0) * 0.03).toLocaleString()}+ monthly clicks.`
    );
  } else if (gsc.position <= 10 && gsc.ctr < 3) {
    notes.push(
      `Page 1 but low CTR (${gsc.ctr}%) — rewrite title tag and meta description to be more compelling.`
    );
  } else if (gsc.position <= 3) {
    notes.push(`Top 3 ranking. Focus on maintaining position and improving CTR.`);
  }

  // Check if article ranks for unexpected queries (different from its primary keyword)
  const unexpectedTopQuery = topQueries.find(
    (q) => q.position <= 10 && !article.primaryKeyword.includes(q.query.split(' ')[0])
  );
  if (unexpectedTopQuery) {
    notes.push(
      `Also ranking for "${unexpectedTopQuery.query}" (pos ${unexpectedTopQuery.position}) — consider expanding this angle with a dedicated section.`
    );
  }

  if (keyword.keywordDifficulty !== null && keyword.keywordDifficulty < 30 && !gsc.position) {
    notes.push(
      `Low keyword difficulty (${keyword.keywordDifficulty}/100) — relatively easy win. Prioritize for optimization.`
    );
  }

  return notes;
}

async function auditArticles() {
  console.log('Auditing existing articles...');

  const gscData = JSON.parse(readFileSync(GSC_PATH, 'utf-8'));
  const kwData = JSON.parse(readFileSync(KEYWORD_PATH, 'utf-8'));
  const opps = JSON.parse(readFileSync(OPPORTUNITIES_PATH, 'utf-8'));
  const articleQueue = JSON.parse(readFileSync(ARTICLE_QUEUE_PATH, 'utf-8'));

  // Index article-queue primary_keywords by slug (source of truth for target keywords)
  const queueBySlug = new Map();
  for (const a of articleQueue.articles || []) {
    queueBySlug.set(a.slug, a.primary_keywords || []);
  }

  // Index GSC pages by URL
  const gscByPage = new Map();
  for (const page of gscData.pages || []) {
    // Normalize: strip trailing slash
    const url = page.page.replace(/\/$/, '');
    gscByPage.set(url, page);
  }

  // Index GSC queries by page URL
  const queriesByPage = new Map();
  for (const q of gscData.queries || []) {
    const url = q.page.replace(/\/$/, '');
    if (!queriesByPage.has(url)) queriesByPage.set(url, []);
    queriesByPage.get(url).push(q);
  }

  // Index keyword data
  const kwByKeyword = new Map();
  for (const kw of kwData.keywords || []) {
    kwByKeyword.set(kw.keyword?.toLowerCase(), kw);
  }

  // Index opportunity pipeline by slug
  const oppBySlug = new Map();
  for (const opp of opps.topActions || []) {
    oppBySlug.set(opp.slug, opp);
  }

  // Audit each article
  const mdxFiles = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  const audited = [];

  for (const file of mdxFiles) {
    const slug = file.replace('.mdx', '');
    const raw = readFileSync(join(BLOG_DIR, file), 'utf-8');
    const { data: fm } = matter(raw);

    const pageUrl = `${BASE_URL}/blog/${slug}`;
    const gsc = gscByPage.get(pageUrl);

    const topQueries = (queriesByPage.get(pageUrl) || [])
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((q) => ({
        query: q.query,
        position: q.position,
        impressions: q.impressions,
        clicks: q.clicks,
        ctr: q.ctr,
      }));

    const tags = fm.tags || [];
    // Use article-queue primary_keywords as source of truth (actual long-tail phrases we target)
    // Fall back to first tag if not in queue
    const queueKeywords = queueBySlug.get(slug) || [];
    const primaryKeyword = (queueKeywords[0] || tags[0] || '').toLowerCase();
    const kwStats = kwByKeyword.get(primaryKeyword) || {};

    const position = gsc?.position ?? null;
    const impressions = gsc?.impressions ?? 0;
    const clicks = gsc?.clicks ?? 0;
    const ctr = gsc?.ctr ?? 0;
    const searchVolume = kwStats.searchVolume ?? null;
    const difficulty = kwStats.keywordDifficulty ?? null;

    const articleData = {
      slug,
      title: fm.title,
      primaryKeyword,
      targetKeywords: queueKeywords.length > 0 ? queueKeywords : tags,
      allTags: tags,
      category: fm.category || null,
      seoTitle: fm.seoTitle || null,

      gsc: {
        url: pageUrl,
        position,
        impressions,
        clicks,
        ctr,
        dataAvailable: !!gsc,
      },

      keyword: {
        searchVolume,
        keywordDifficulty: difficulty,
        intent: kwStats.intent ?? null,
        competition: kwStats.competition ?? null,
        competitionLevel: kwStats.competitionLevel ?? null,
        cpc: kwStats.cpc ?? null,
      },

      topQueries,

      analysis: {
        rankStatus: getRankStatus(position),
        opportunityLevel: getOpportunityLevel(searchVolume, position, difficulty),
        gapScore: computeGapScore(searchVolume, position, clicks),
        notes: [],
      },
    };

    articleData.analysis.notes = generateNotes(articleData);
    audited.push(articleData);
  }

  // Sort by gap score descending (highest opportunity first)
  audited.sort((a, b) => b.analysis.gapScore - a.analysis.gapScore);

  // Keyword gaps: opportunities in pipeline with no article yet
  const coveredSlugs = new Set(mdxFiles.map((f) => f.replace('.mdx', '')));
  const keywordGaps = [];

  for (const opp of opps.topActions || []) {
    if (coveredSlugs.has(opp.slug)) continue;

    const kwStats = kwByKeyword.get(opp.keyword?.toLowerCase()) || {};
    const sv = kwStats.searchVolume ?? null;
    const kd = kwStats.keywordDifficulty ?? null;

    // Data-driven score: volume / difficulty (if available), else fall back to pipeline score
    const dataScore =
      sv !== null && kd !== null
        ? Math.round((sv / Math.max(kd, 1)) * 10)
        : sv !== null
        ? Math.round(sv / 5)
        : null;

    keywordGaps.push({
      slug: opp.slug,
      keyword: opp.keyword,
      category: opp.category,
      pipelineScore: opp.score,
      dataScore,
      effectiveScore: dataScore ?? opp.score,
      searchVolume: sv,
      keywordDifficulty: kd,
      competition: kwStats.competitionLevel ?? null,
      cpc: kwStats.cpc ?? null,
      notes: opp.notes || null,
    });
  }

  // Sort gaps by effective score (data-driven first)
  keywordGaps.sort((a, b) => (b.effectiveScore ?? 0) - (a.effectiveScore ?? 0));

  const summary = {
    totalArticles: audited.length,
    top3: audited.filter((a) => a.analysis.rankStatus === 'top_3').length,
    page1: audited.filter((a) => a.analysis.rankStatus === 'page_1').length,
    page2: audited.filter((a) => a.analysis.rankStatus === 'page_2').length,
    notRanking: audited.filter((a) => a.analysis.rankStatus === 'not_ranking').length,
    highOpportunity: audited.filter((a) => a.analysis.opportunityLevel === 'high').length,
    mediumOpportunity: audited.filter((a) => a.analysis.opportunityLevel === 'medium').length,
    keywordGaps: keywordGaps.length,
    gscDataAvailable: audited.filter((a) => a.gsc.dataAvailable).length,
  };

  const output = {
    version: '1.0',
    note: 'Auto-generated by audit-articles.js. Do not edit manually. Re-run after pipeline updates.',
    generatedAt: new Date().toISOString(),
    summary,
    existingArticles: audited,
    keywordGaps,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nArticle audit complete -> article-audit.json`);
  console.log(`  ${audited.length} articles audited`);
  console.log(
    `  Top 3: ${summary.top3} | Page 1: ${summary.page1} | Page 2: ${summary.page2} | Not ranking: ${summary.notRanking}`
  );
  console.log(`  High opportunity: ${summary.highOpportunity} | Medium: ${summary.mediumOpportunity}`);
  console.log(`  Keyword gaps to write: ${keywordGaps.length}`);
  console.log(`  GSC data available for: ${summary.gscDataAvailable} articles`);

  return output;
}

auditArticles().catch((err) => {
  console.error('audit-articles failed:', err.message);
  process.exit(1);
});
