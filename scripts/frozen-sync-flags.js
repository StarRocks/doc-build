#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Emit the `aws s3 sync` --exclude flags that keep the frozen doc trees alive.
//
// The deploy mirrors build/ onto the BUCKET ROOT, which is the URL root, so any
// key the current build does not produce is deleted. Once a version stops being
// built, the only thing standing between its ~3,000 pages and `--delete` is the
// exclude list. Generating it from frozenVersions.json means it cannot drift
// from the versions that are actually frozen. See ARCHIVE.md.
//
// Usage (in a workflow):
//   FROZEN_EXCLUDES="$(node scripts/frozen-sync-flags.js)"
//
// The locale roots are deliberately hard-coded rather than read from
// docusaurus.config.js `i18n.locales`. They are a historical fact — the set of
// locales that existed when these versions were frozen — not current config:
//
//   * a locale ADDED later has no frozen tree to protect, because the frozen
//     versions were built before it existed, and
//   * a locale REMOVED later still has a frozen tree sitting in S3 that must
//     keep being protected.
//
// Deriving this list from the live config would get the second case wrong and
// silently delete that locale's archive on the next deploy.
// -----------------------------------------------------------------------------

const frozenVersions = require('../frozenVersions.json');

const LOCALE_ROOTS = ['', 'zh/', 'ja/'];

if (!Array.isArray(frozenVersions)) {
  console.error('frozen-sync-flags: frozenVersions.json is not an array.');
  process.exit(1);
}

// An empty list would emit no flags at all, turning the deploy back into a bare
// mirroring sync. That is exactly the failure this script exists to prevent, so
// treat it as an error rather than printing nothing.
if (frozenVersions.length === 0) {
  console.error(
    'frozen-sync-flags: frozenVersions.json is empty.\n' +
      'If nothing is frozen, remove the two-pass sync from the workflows\n' +
      'deliberately rather than letting this script emit an empty flag list.',
  );
  process.exit(1);
}

const flags = [];
for (const version of frozenVersions) {
  if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)) {
    console.error(
      `frozen-sync-flags: "${version}" is not a <major>.<minor> version string.`,
    );
    process.exit(1);
  }
  for (const root of LOCALE_ROOTS) {
    flags.push(`--exclude ${root}docs/${version}/*`);
  }
}

process.stdout.write(flags.join(' '));
