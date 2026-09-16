#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Regenerate frozenSitemapPaths.txt from a deployed sitemap-algolia.xml.
//
// Frozen versions are served but not built, so nothing in a normal build can
// produce their sitemap entries — docusaurus.config.js injects them from
// frozenSitemapPaths.txt instead. That file therefore has to be refreshed
// whenever the archive itself changes, i.e. after an archive rebuild that adds
// or removes pages. See ARCHIVE.md.
//
// WHEN TO RUN IT: right after a `Rebuild_doc_archive` run. In that build the
// frozen versions are real routes, so the config skips the injection and the
// published sitemap lists exactly what the archive actually contains. Run
// against any other build and you just read back the file you already have,
// because the injection is what put those entries there.
//
// Usage:
//   node scripts/regenerate-frozen-sitemap-paths.js                 # prod
//   node scripts/regenerate-frozen-sitemap-paths.js <sitemap-url>
//   node scripts/regenerate-frozen-sitemap-paths.js --check         # no write
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const frozenVersions = require('../frozenVersions.json');

const DEFAULT_SITEMAP = 'https://docs.starrocks.io/sitemap-algolia.xml';
const OUT = path.join(__dirname, '..', 'frozenSitemapPaths.txt');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const sitemapUrl = args.find((a) => !a.startsWith('--')) ?? DEFAULT_SITEMAP;

// Only paths under a frozen version count. Built versions are produced by the
// build itself and must never end up in this file.
const frozenPrefixes = frozenVersions.map((v) => `/docs/${v}/`);
const isFrozen = (p) => frozenPrefixes.some((prefix) => p.startsWith(prefix));

async function main() {
  console.log(`Reading ${sitemapUrl}`);
  const res = await fetch(sitemapUrl);
  if (!res.ok) {
    console.error(`\n✖ ${sitemapUrl} returned HTTP ${res.status}\n`);
    process.exit(1);
  }
  const xml = await res.text();

  const paths = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => {
          try {
            return new URL(m[1]).pathname;
          } catch {
            return null;
          }
        })
        .filter((p) => p && isFrozen(p)),
    ),
  ].sort();

  if (paths.length === 0) {
    console.error(
      `\n✖ No frozen paths found in that sitemap.\n\n` +
        `Expected entries under ${frozenPrefixes.join(', ')}.\n` +
        `If you pointed this at a locale sitemap (/zh/sitemap-algolia.xml), use the\n` +
        `root one instead — the Algolia crawler reads only that file.\n`,
    );
    process.exit(1);
  }

  const previous = fs.existsSync(OUT)
    ? fs.readFileSync(OUT, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const previousSet = new Set(previous);
  const currentSet = new Set(paths);
  const added = paths.filter((p) => !previousSet.has(p));
  const removed = previous.filter((p) => !currentSet.has(p));

  const perVersion = frozenVersions
    .map((v) => `${v}: ${paths.filter((p) => p.startsWith(`/docs/${v}/`)).length}`)
    .join(', ');

  console.log(`\n${paths.length} frozen paths (${perVersion})`);
  console.log(`  was ${previous.length}, +${added.length} / -${removed.length}`);
  const show = (label, list) =>
    list.slice(0, 10).forEach((p) => console.log(`    ${label} ${p}`));
  show('+', added);
  show('-', removed);
  if (added.length + removed.length > 20) {
    console.log('    …');
  }

  if (checkOnly) {
    console.log('\n--check: not writing.');
    process.exit(added.length || removed.length ? 1 : 0);
  }

  fs.writeFileSync(OUT, `${paths.join('\n')}\n`);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
});
