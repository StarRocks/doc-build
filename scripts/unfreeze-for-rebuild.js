#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Put the frozen versions back into versions.json, in memory of the build only.
//
// versions.json is Docusaurus's own versioning manifest: plugin-content-docs
// reads it off disk (versions/files.js readVersionsFile), not through our
// config. cli.js reads the same file to decide which starrocks branches to
// check out. So making a build emit the frozen versions again is exactly one
// edit — this one — and everything downstream follows.
//
// Run by .github/workflows/rebuild_archive.yml BEFORE `npm run copy`. Never run
// it in the normal deploy: versions.json is committed, and a rebuild run must
// not leave the repo modified.
//
// The result is a build identical in shape to the pre-freeze one, which is why
// the rebuild workflow can use a plain mirroring sync with no frozen excludes —
// every version it would otherwise need to protect is being uploaded.
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const versionsPath = path.join(root, 'versions.json');

const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
const frozen = JSON.parse(fs.readFileSync(path.join(root, 'frozenVersions.json'), 'utf8'));

// Newest first, which is the order Docusaurus and `BUILD_FAST` both assume.
const compare = (a, b) => {
  const [aMaj, aMin] = a.split('.').map(Number);
  const [bMaj, bMin] = b.split('.').map(Number);
  return bMaj - aMaj || bMin - aMin;
};

const merged = [...new Set([...versions, ...frozen])].sort(compare);

if (merged.length === versions.length) {
  console.log(
    `versions.json already contains every frozen version (${merged.join(', ')}) — nothing to do.`,
  );
} else {
  const added = merged.filter((v) => !versions.includes(v));
  fs.writeFileSync(versionsPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Restored frozen version(s) for this build: ${added.join(', ')}`);
  console.log(`versions.json is now: ${merged.join(', ')}`);
}
