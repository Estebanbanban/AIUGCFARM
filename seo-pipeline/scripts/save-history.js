/**
 * save-history.js
 * Reads the current pipeline outputs and appends a new snapshot to pipeline-history.json.
 * Called automatically at the end of run-pipeline.js.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, '..');
const BLOG_DIR = resolve(PIPELINE_DIR, '..', 'frontend', 'src', 'content', 'blog');

const HISTORY_PATH = join(PIPELINE_DIR, 'pipeline-history.json');
const GSC_PATH = join(PIPELINE_DIR, 'gsc-data.json');
const AUDIT_PATH = join(PIPELINE_DIR, 'article-audit.json');
const KW_PATH = join(PIPELINE_DIR, 'keyword-data.json');
const BACKLOG_PATH = join(PIPELINE_DIR, 'article-backlog.json');

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function computeDelta(current, previous) {
  if (!previous) return null;
  return {
    impressionsDelta: current.gscSummary.totalImpressions - previous.gscSummary.totalImpressions,
    clicksDelta: current.gscSummary.totalClicks - previous.gscSummary.totalClicks,
    page1Delta: current.articleStatus.page1 - previous.articleStatus.page1,
    notRankingDelta: current.articleStatus.notRanking - previous.articleStatus.notRanking,
    newlyRanking: [], // would need slug-level comparison for this
    previousRunDate: previous.date,
  };
}

async function saveHistory() {
  const history = readJson(HISTORY_PATH) || { version: '1.0', runs: [] };
  const gsc = readJson(GSC_PATH);
  const audit = readJson(AUDIT_PATH);
  const kw = readJson(KW_PATH);
  const backlog = readJson(BACKLOG_PATH);

  if (!gsc || !audit) {
    console.warn('save-history: missing gsc-data.json or article-audit.json, skipping');
    return;
  }

  const totalImpressions = (gsc.pages || []).reduce((s, p) => s + (p.impressions || 0), 0);
  const totalClicks = (gsc.pages || []).reduce((s, p) => s + (p.clicks || 0), 0);
  const blogPages = (gsc.pages || []).filter(p => p.page?.includes('/blog/')).length;
  const avgPos = (gsc.pages || []).length > 0
    ? gsc.pages.reduce((s, p) => s + (p.position || 0), 0) / gsc.pages.length
    : 0;

  const withVolume = (kw?.keywords || []).filter(k => k.searchVolume && k.volumeSource === 'exact').length;
  const withSeed = (kw?.keywords || []).filter(k => k.searchVolume && k.volumeSource?.startsWith('seed')).length;
  const topKw = (kw?.keywords || []).sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))[0];

  const backlogStats = backlog ? {
    total: backlog.articles?.length || 0,
    pending: backlog.articles?.filter(a => a.status === 'pending').length || 0,
    inProgress: backlog.articles?.filter(a => a.status === 'in-progress').length || 0,
    written: backlog.articles?.filter(a => a.status === 'written').length || 0,
    published: backlog.articles?.filter(a => a.status === 'published').length || 0,
  } : null;

  const currentRun = {
    runId: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    triggeredBy: 'pipeline run',
    gscSummary: {
      totalPages: (gsc.pages || []).length,
      blogPages,
      totalImpressions,
      totalClicks,
      avgPosition: Math.round(avgPos * 10) / 10,
      dateRange: gsc.dateRange,
    },
    articleStatus: audit.summary || {},
    rankingArticles: (audit.existingArticles || [])
      .filter(a => a.gsc.position)
      .map(a => ({
        slug: a.slug,
        position: a.gsc.position,
        impressions: a.gsc.impressions,
        clicks: a.gsc.clicks,
        ctr: a.gsc.ctr,
        topQuery: a.topQueries?.[0]?.query || null,
      })),
    keywordData: {
      totalEnriched: kw?.totalKeywords || 0,
      withVolume,
      withVolumeViaSeed: withSeed,
      topOpportunity: topKw ? {
        keyword: topKw.keyword,
        volume: topKw.searchVolume,
        kd: topKw.keywordDifficulty,
      } : null,
    },
    backlogStatus: backlogStats,
    deltaFromPrevious: null,
  };

  // Compute delta vs previous run
  const previousRun = history.runs[history.runs.length - 1] || null;
  currentRun.deltaFromPrevious = computeDelta(currentRun, previousRun);

  history.runs.push(currentRun);

  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

  // Print delta summary
  if (currentRun.deltaFromPrevious) {
    const d = currentRun.deltaFromPrevious;
    console.log(`  vs ${d.previousRunDate}: impressions ${d.impressionsDelta >= 0 ? '+' : ''}${d.impressionsDelta} | clicks ${d.clicksDelta >= 0 ? '+' : ''}${d.clicksDelta} | page1 ${d.page1Delta >= 0 ? '+' : ''}${d.page1Delta}`);
  }

  console.log(`History snapshot saved (run #${history.runs.length})`);
}

saveHistory().catch(console.error);
