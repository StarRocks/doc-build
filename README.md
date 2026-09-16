# doc-build

These are the published URLs for staging and production:

- Staging, sandbox, test: https://docs-stage.starrocks.io/docs/introduction/StarRocks_intro/
- Production: https://docs.starrocks.io/docs/introduction/StarRocks_intro/

## Building staging or production

There are GitHub workflows to build staging and production. These are run each weekday on a schedule. They can also be run on demand from the repo Actions menu.

## Building locally

You can build all of the languages and versions on a Macbook M2 with 16 GB RAM. Other machines may also build fine. To do this run these commands from the `doc-build` directory:

```bash
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=8192"
export DOCUSAURUS_SSR_CONCURRENCY=8
export DOCUSAURUS_PERF_LOGGER=true
yarn clear && yarn build && yarn serve
```

## Changing versions

`versions.json` is the single source of truth. It lists the versions that get
built, newest first, and it is read by both Docusaurus (as its versioning
manifest) and `cli.js` (to pick which `branch-<version>` to check out of the
starrocks repo).

`docusaurus.config.js` derives everything else from it: `includedVersions`, and
the per-version label and banner map. You do not edit a parallel list.

### Rolling a new release

1. Add the version to the top of `versions.json`.
2. Set `lastVersion` in `docusaurus.config.js` to it. This is the only other
   edit, and it matters — `lastVersion` is served unprefixed at `/docs/`, it
   drives the `Latest-` label, and the sitemap tiering derives from it.
   `scripts/check-sitemap-markdown-coverage.js` fails the build if you forget.
3. If the "Stable" release moves, update `STABLE_VERSION` in
   `docusaurus.config.js`. Labels are otherwise generated.
4. Update `releasenotes-sidebars.json`, and the zh `current.json` in the
   starrocks repo.

### Retiring a version

Do not just delete it — that removes the pages from the site. Versions are
**frozen** instead: no longer built, still served from S3. See
[ARCHIVE.md](./ARCHIVE.md) for the invariants and the runbook, and for how to
rebuild the archive if a frozen page ever has to change.

