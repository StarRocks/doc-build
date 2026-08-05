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
// docusaurus.config.js fixes that two ways: `sitemap.ignorePatterns` drops the
// archived trees from the public sitemap entirely (they are Disallow'ed in
// robots.txt anyway), and `sitemap.createSitemapItems` sorts what remains so real
// content precedes the ~90 auto-generated /docs/category/** navigation stubs,
// which would otherwise cluster alphabetically near the head.
//
// Archived versions are NOT lost — they move to /sitemap-algolia.xml, which is
// what the Algolia DocSearch crawler reads (search is supported for every
// version). This script asserts that file stays complete, which is the safety
// net for the whole arrangement. See SITEMAPS.md.
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
const algoliaSitemapPath = path.join(buildDir, 'sitemap-algolia.xml');

// Site URL varies by environment (prod vs. staging), so compare pathnames.
function readSitemapPathnames(file, label) {
  if (!fs.existsSync(file)) {
    console.error(
      `\n✖ Sitemap coverage: no ${label} at ${path.relative(process.cwd(), file)}\n` +
        `  Run this after \`yarn build\`.\n`,
    );
    process.exit(1);
  }
  const locs = [...fs.readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );
  if (locs.length === 0) {
    console.error(`\n✖ Sitemap coverage: ${label} contains no <loc> entries.\n`);
    process.exit(1);
  }
  return locs.map((loc) => {
    try {
      return new URL(loc).pathname;
    } catch {
      return loc;
    }
  });
}

const pathnames = readSitemapPathnames(sitemapPath, 'sitemap.xml');
const algoliaPathnames = readSitemapPathnames(algoliaSitemapPath, 'sitemap-algolia.xml');

const ARCHIVED = /^\/docs\/[0-9]+\.[0-9]+\//;
const sample = pathnames.slice(0, SAMPLE_SIZE);

// 1. The public sitemap must contain NO archived-version URLs at all. They are
//    Disallow'ed for every user-agent in static/robots.txt, and they live in
//    sitemap-algolia.xml instead (asserted below).
const archivedInPublic = pathnames.filter((p) => ARCHIVED.test(p));
if (archivedInPublic.length) {
  const prefixes = [...new Set(archivedInPublic.map((p) => p.match(ARCHIVED)[0]))];
  console.error(
    `\n✖ Sitemap coverage: ${archivedInPublic.length} archived-version URL(s) in ` +
      `sitemap.xml.\n\n` +
      `Prefixes found:\n` +
      prefixes.map((p) => `    ${p}`).join('\n') +
      `\n\nThese are Disallow'ed in static/robots.txt, so advertising them here is\n` +
      `contradictory — and they have no Markdown twin, so a checker sampling the\n` +
      `head of the sitemap reports that the server ignores \`Accept: text/markdown\`.\n\n` +
      `\`sitemap.ignorePatterns\` in docusaurus.config.js derives from \`archivedVersions\`;\n` +
      `check that a version roll updated \`lastVersion\`. Do NOT remove them from\n` +
      `sitemap-algolia.xml — that is the only file Algolia DocSearch has for them.\n`,
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

// 3. sitemap-algolia.xml is Algolia DocSearch's ground truth and must stay a
//    complete superset of the public sitemap. These two assertions are what make
//    it safe to trim /sitemap.xml down to the current version: if the trim ever
//    takes archived versions out of BOTH files, search silently loses 3.1–4.0
//    and nothing else in the pipeline would notice.
const algoliaSet = new Set(algoliaPathnames);
const missingFromAlgolia = pathnames.filter((p) => !algoliaSet.has(p));
if (missingFromAlgolia.length) {
  console.error(
    `\n✖ Sitemap coverage: ${missingFromAlgolia.length} URL(s) are in sitemap.xml but ` +
      `NOT in sitemap-algolia.xml.\n\n` +
      `The Algolia sitemap must be a superset of the public one — it is what the\n` +
      `DocSearch crawler indexes. Its plugin instance in docusaurus.config.js should\n` +
      `carry no ignorePatterns.\n\n` +
      missingFromAlgolia.slice(0, 10).map((p) => `    ${p}`).join('\n') +
      (missingFromAlgolia.length > 10 ? `\n    … and ${missingFromAlgolia.length - 10} more` : '') +
      `\n`,
  );
  process.exit(1);
}

const algoliaArchived = algoliaPathnames.filter((p) => ARCHIVED.test(p)).length;
if (algoliaArchived === 0) {
  console.error(
    `\n✖ Sitemap coverage: sitemap-algolia.xml contains no archived-version URLs.\n\n` +
      `Search is supported for every version, so the Algolia sitemap must list the\n` +
      `archived doc trees (/docs/4.0/…, /docs/3.5/…, …). Its plugin instance in\n` +
      `docusaurus.config.js must not filter them out.\n`,
  );
  process.exit(1);
}

const archivedTotal = pathnames.filter((p) => ARCHIVED.test(p)).length;
console.log(
  `✔ Sitemap markdown coverage: ${withTwin.length}/${sample.length} of the first ` +
    `${SAMPLE_SIZE} URLs have a Markdown twin ` +
    `(sitemap.xml: ${pathnames.length} URLs, ${archivedTotal} archived; ` +
    `sitemap-algolia.xml: ${algoliaPathnames.length} URLs, ${algoliaArchived} archived).`,
);
