#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Guard the head of the sitemap against archived-version flooding.
//
// Agent-readiness checkers (afdocs.dev among them) probe content negotiation by
// sampling pages from sitemap.xml and asking each one for `Accept: text/markdown`.
// They sample from the HEAD of the file, not uniformly at random.
//
// Docusaurus emits archived doc versions FIRST, and those pages deliberately have
// no Markdown twin (the llms-txt plugin runs with includeVersionedDocs: false, so
// the CloudFront Function passes them through as HTML). With seven versions live
// that put ~5,800 twin-less URLs ahead of the first page that has one — so every
// sampled page returned HTML and the check reported "server ignores
// Accept: text/markdown (0/50 sampled pages return markdown)" even though
// negotiation was working perfectly on the current docs.
//
// docusaurus.config.js fixes that with `sitemap.createSitemapItems`, which sorts
// entries into three tiers: real current-version content, then navigation stubs
// (/docs/category/**, section indexes, /search/), then archived versions. Note it
// REORDERS rather than trims: archived versions must stay in the sitemap because
// it is Algolia DocSearch's ground truth and search is supported for every
// version (see the `Algolia Crawler` exemption in static/robots.txt).
//
// This script replays what a sampler sees: take the first N URLs and count how
// many have a Markdown twin according to src/agentDocsRoutes.js — the same source
// of truth the CloudFront Function mirrors. If a version roll, a config edit, or a
// plugin upgrade lets archived routes back into the head of the sitemap, this
// fails the build instead of quietly costing the score weeks later.
//
// Usage: node scripts/check-sitemap-markdown-coverage.js [buildDir]
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const {hasMarkdownTwin} = require('../src/agentDocsRoutes');

// How many leading URLs a sampler is assumed to take. afdocs.dev samples 50.
// Checked with headroom so a checker that samples somewhat deeper still passes.
const SAMPLE_SIZE = 100;

// Minimum fraction of that sample that must have a Markdown twin. The config
// sorts all ~1,040 twin-bearing routes ahead of everything else, so a correct
// build scores 100/100 here; the slack is only so that adding a handful of
// navigation stubs does not fail a deploy.
const MIN_COVERAGE = 0.9;

const buildDir = path.resolve(process.argv[2] || 'build');
const sitemapPath = path.join(buildDir, 'sitemap.xml');

if (!fs.existsSync(sitemapPath)) {
  console.error(
    `\n✖ Sitemap coverage: no sitemap.xml at ${path.relative(process.cwd(), sitemapPath)}\n` +
      `  Run this after \`yarn build\`.\n`,
  );
  process.exit(1);
}

const xml = fs.readFileSync(sitemapPath, 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (locs.length === 0) {
  console.error('\n✖ Sitemap coverage: sitemap.xml contains no <loc> entries.\n');
  process.exit(1);
}

// Site URL varies by environment (prod vs. staging), so compare pathnames.
const pathnames = locs.map((loc) => {
  try {
    return new URL(loc).pathname;
  } catch {
    return loc;
  }
});

const ARCHIVED = /^\/docs\/[0-9]+\.[0-9]+\//;
const sample = pathnames.slice(0, SAMPLE_SIZE);

// 1. No archived-version URL may appear in the head of the sitemap. They belong
//    in the sitemap (Algolia crawls them) but must sort to the end.
const archivedInHead = sample.filter((p) => ARCHIVED.test(p));
if (archivedInHead.length) {
  const prefixes = [...new Set(archivedInHead.map((p) => p.match(ARCHIVED)[0]))];
  console.error(
    `\n✖ Sitemap coverage: ${archivedInHead.length} archived-version URL(s) in the ` +
      `first ${SAMPLE_SIZE} sitemap entries.\n\n` +
      `Prefixes found:\n` +
      prefixes.map((p) => `    ${p}`).join('\n') +
      `\n\nArchived versions have no Markdown twin, so a checker sampling the head of\n` +
      `the sitemap will report that the server ignores \`Accept: text/markdown\`.\n` +
      `They should sort to the END via \`sitemap.createSitemapItems\` in\n` +
      `docusaurus.config.js — check that a version roll updated \`lastVersion\`.\n` +
      `Do NOT delete them: Algolia DocSearch crawls the sitemap for every version.\n`,
  );
  process.exit(1);
}

// 2. The head must actually look markdown-capable to a sampler.
const withTwin = sample.filter(hasMarkdownTwin);
const coverage = withTwin.length / sample.length;

if (coverage < MIN_COVERAGE) {
  const missing = sample.filter((p) => !hasMarkdownTwin(p));
  console.error(
    `\n✖ Sitemap coverage: only ${withTwin.length}/${sample.length} of the first ` +
      `${SAMPLE_SIZE} sitemap URLs have a Markdown twin ` +
      `(need ${Math.round(MIN_COVERAGE * 100)}%).\n\n` +
      `Agent checkers sampling the head of the sitemap will report that the server\n` +
      `ignores \`Accept: text/markdown\`. Routes without a twin:\n` +
      missing.map((p) => `    ${p}`).join('\n') +
      `\n`,
  );
  process.exit(1);
}

const archivedTotal = pathnames.filter((p) => ARCHIVED.test(p)).length;
console.log(
  `✔ Sitemap markdown coverage: ${withTwin.length}/${sample.length} of the first ` +
    `${SAMPLE_SIZE} URLs have a Markdown twin ` +
    `(${pathnames.length} URLs total; ${archivedTotal} archived-version URLs, all sorted to the end).`,
);
