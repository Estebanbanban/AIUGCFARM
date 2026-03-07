/**
 * run-pipeline.js
 * Master runner. Executes the full SEO data pipeline in sequence:
 *   1. pull-gsc-data.js   — fetch real GSC impressions/clicks/position
 *   2. enrich-keywords.js — fetch DataForSEO volumes + difficulty
 *   3. audit-articles.js  — cross-reference and produce article-audit.json
 *
 * Usage: node scripts/run-pipeline.js
 *        bun run pipeline     (from seo-pipeline/)
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  { file: 'pull-gsc-data.js', label: 'Step 1/3 — GSC Data Pull' },
  { file: 'enrich-keywords.js', label: 'Step 2/3 — Keyword Enrichment (DataForSEO)' },
  { file: 'audit-articles.js', label: 'Step 3/3 — Article Audit' },
];

function hr(char = '-', len = 60) {
  return char.repeat(len);
}

function runPipeline() {
  const start = Date.now();
  console.log(hr('='));
  console.log('CineRads SEO Pipeline');
  console.log(hr('='));

  for (const { file, label } of STEPS) {
    console.log(`\n${hr()}`);
    console.log(label);
    console.log(hr());

    const result = spawnSync('node', [join(__dirname, file)], { stdio: 'inherit' });

    if (result.status !== 0) {
      console.error(`\nPipeline aborted at: ${label}`);
      process.exit(result.status ?? 1);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${hr('=')}`);
  console.log(`Pipeline complete in ${elapsed}s`);
  console.log('');
  console.log('Outputs:');
  console.log('  seo-pipeline/gsc-data.json      — real GSC ranking data');
  console.log('  seo-pipeline/keyword-data.json   — DataForSEO volumes + difficulty');
  console.log('  seo-pipeline/article-audit.json  — gap analysis, sorted by opportunity');
  console.log('');
  console.log('Next: open article-audit.json or run the cinerads-seo-article-gen skill.');
  console.log(hr('='));
}

runPipeline();
