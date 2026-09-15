# Frozen doc versions

Some doc versions are **frozen**: they are no longer built, but the HTML that was
built for them is still served from S3, at the same URLs, indefinitely.

`frozenVersions.json` is the single source of truth for which versions those are.

## Why freeze instead of delete

Every deploy built 7 versions x 3 locales. That was the dominant cost of the daily
build and the reason the build runs one locale per node process (all three in one
process is OOM-killed). Versions below 3.5 no longer change, so rebuilding them
daily bought nothing — but the pages are still linked, bookmarked, and searched.

## The three invariants

Anyone touching the deploy has to preserve all three. Breaking any one of them
deletes ~12,000 HTML files that no build can regenerate.

### 1. The frozen doc trees are excluded from `aws s3 sync --delete`

The sync mirrors `build/` onto the **bucket root**, which is the URL root. Any key
not produced by the current build is deleted. `scripts/frozen-sync-flags.js`
generates the `--exclude` flags from `frozenVersions.json` so they cannot drift.

### 2. `assets/` is append-only

This is the non-obvious one. Frozen pages load content-hashed JS and CSS that the
current build will never emit again. Docusaurus puts **everything** it hashes under
the per-locale `assets/` directory — `assets/js`, `assets/css`, and
`assets/images`, `assets/fonts`, `assets/medias`, `assets/files`
(`OUTPUT_STATIC_ASSETS_DIR_NAME` in `@docusaurus/utils`). So excluding the doc trees
alone is not enough: a mirroring sync would delete every chunk the frozen HTML
references and leave 12,000 unstyled, unhydrated pages.

The deploy therefore runs **two** passes, in this order:

1. `assets/`, `zh/assets/`, `ja/assets/` — additive, **no `--delete`**.
2. everything else — `--delete`, excluding `assets/` and the frozen doc trees.

Assets go **first**. Uploading HTML before the chunks it references leaves a window
in which every page on the site 404s on its JS, and CloudFront caches those 404s
(the invalidation runs last). Content-hashed names mean pass 1 can never overwrite
a file with different content.

**Do not add an S3 lifecycle rule to prune `assets/`.** The frozen assets are the
*oldest* objects in the prefix, so age-based expiry deletes exactly the wrong ones.
`frozenAssets.txt` is the manifest captured at freeze time; a future garbage
collector can delete `assets/*` keys that are in neither the current build nor that
manifest. The manifest cannot be reconstructed later — webpack builds chunk URLs
from an in-JS `chunkId -> hash` map, so the referenced set is not recoverable by
grepping the frozen HTML.

### 3. Frozen pages must never be reached, or left, by client-side routing

A frozen page's bundle still carries the route map of the whole site as it stood on
freeze day. Two failure modes:

- **Leaving** a frozen page client-side renders a freeze-day snapshot of the
  then-latest docs under a live `/docs/...` URL. Handled by
  `src/plugins/frozen-archive.js`, which on frozen pages only forces any navigation
  out of the frozen tree to be a real document request (capture-phase click
  listener plus a `history.pushState`/`replaceState` patch, because DocSearch, the
  locale dropdown and `savePreferredVersionName` do not go through clicks).
  Behavior is pinned by `scripts/test-frozen-archive-guard.js`.
- **Entering** a frozen page client-side renders the live site's 404, because the
  live bundle no longer has those routes. Handled three ways: the archived version
  dropdown entries use the `pathname://` prefix, `algolia.externalUrlRegex` forces
  full page loads for search hits, and `src/theme/NotFound` does a one-shot reload
  for frozen paths as a catch-all.

## Known limitations

- Frozen pages depend on **unhashed** files copied from `static/` (`img/...`), which
  stay under normal `--delete` handling. Deleting an image from `static/` can break
  a frozen page. This is not protected — be aware of it when pruning `static/`.
- Frozen pages keep their freeze-day navbar, announcement bar and footer forever.
- Search keeps working because `frozenSitemapPaths.txt` is injected into
  `sitemap-algolia.xml`, which is the only file the Algolia crawler reads. Do not set
  `noIndex` on a frozen version: the crawler honors `<meta name="robots">` and would
  silently drop it from search, despite the
  `User-Agent: Algolia Crawler / Allow: /` group in `static/robots.txt`.

## Runbook: freezing the next version

The order matters, and it is **three separate merges**. The reason is that
`actions/checkout` honors the `docBuildBranch` input, but the workflow's `run:`
blocks come from the **dispatch ref** — and from the default branch for the cron.
So "dispatch from main with `docBuildBranch: my-branch`" gives you the new build
with the old sync command, which wipes the trees you meant to keep.

Run each step against **stage** before prod. Note stage is normally dispatched with
`docVersionsToBuild: TopTwo`, which only builds 4.1 and 4.0 — use `All` or there is
nothing to freeze.

1. **Freeze markers.** Add the version to `frozenVersions.json` and set
   `banner: 'unmaintained'` on it in `docusaurus.config.js`. Still builds every
   version. Deploy this to prod: it is the last build that emits the version, so the
   banner and the navigation guard have to be baked in now.
2. **Protect S3.** Back up first — enable bucket versioning or sync the trees to a
   backup prefix. Then merge the sync excludes (no build change) and deploy. Verify
   `LastModified` on `docs/<version>/index.html` did not advance. Capture the
   manifests from the bucket, which at this point holds exactly the freeze build:
   `aws s3 ls s3://$BUCKET/assets/ --recursive` for `frozenAssets.txt`, and the
   frozen paths out of `sitemap-algolia.xml` for `frozenSitemapPaths.txt`.
   From here the trees are frozen no matter what the build emits — which is what
   makes step 3 safe even if a cron fires right after it lands.
3. **Stop building it.** Remove it from `versions.json`, `includedVersions` and the
   `versions` label map (Docusaurus throws on unknown keys in the latter two, so all
   three move together), add the archived dropdown entry, and extend
   `algolia.externalUrlRegex` and `src/theme/NotFound`.

## Runbook: changing a doc in a frozen version

Frozen versions are not supposed to change, but corrections happen. Before
rebuilding, consider whether you need to: the cheapest fix for a wrong page in a
frozen version is often to fix it in a supported version, or to accept it. A
rebuild is a full CI run and touches the one thing on the site that nothing else
can regenerate.

### The trap

Do **not** simply re-add the version to `versions.json` and run a normal deploy.
`aws s3 sync --exclude` filters the **source** as well as the destination, so
`--exclude docs/3.3/*` means the rebuilt pages are built and then silently *not
uploaded*. The deploy goes green and nothing changes on the site.

### Recommended: a rebuild branch that is dispatched but never merged

Keeping `main` frozen means the protection never lapses and the cron is
unaffected, so there is no window in which a scheduled run can delete the tree.

1. Branch from `main`, e.g. `rebuild-3.3`.
2. Re-add just that version to `versions.json`, to `includedVersions`, and to the
   `versions` label map — keeping `banner: 'unmaintained'`, since the rebuilt
   pages should still say they are unmaintained. Leave `frozenVersions.json`
   alone.
3. On that branch only, replace the two-pass sync with a targeted one that
   writes nothing outside that version:

   ```bash
   # Assets first and additive, as always - the rebuilt pages reference new
   # hashed chunks, and the other frozen versions still need the old ones.
   aws s3 sync build/ s3://$BUCKET/ --quiet \
     --exclude "*" --include "assets/*" --include "zh/assets/*" --include "ja/assets/*"

   # Then only this version's trees. --delete is scoped to the prefix, so pages
   # deleted upstream go away, and nothing else on the site can be touched.
   for root in "" "zh/" "ja/"; do
     aws s3 sync "build/${root}docs/3.3/" "s3://$BUCKET/${root}docs/3.3/" --quiet --delete
   done
   ```

4. Dispatch **stage** with `--ref rebuild-3.3` and `docBuildBranch: rebuild-3.3`.
   The `--ref` is what makes the branch's own workflow run; without it you get
   `main`'s sync step and the trap above. Verify the changed page.
5. Dispatch **prod** the same way.
6. Delete the branch. Do not merge it.

### Afterwards

- If the rebuild added or removed pages, regenerate that version's entries in
  `frozenSitemapPaths.txt`, or Algolia will keep indexing URLs that are gone and
  miss the new ones.
- The rebuilt pages pick up today's navbar, footer and announcement bar, so they
  will not match the other frozen versions exactly. That is cosmetic.
- The old hashed chunks stay in `assets/` - they are still referenced by the
  frozen versions you did not rebuild.
