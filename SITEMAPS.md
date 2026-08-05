# Sitemaps

This site builds **two** sitemaps, because two audiences want opposite things.

| File | Contents | Consumed by | Advertised in robots.txt |
| --- | --- | --- | --- |
| `/sitemap.xml` | Current version + release notes | Search engines, agent-readiness checkers | Yes (`Sitemap:` line) |
| `/sitemap-algolia.xml` | **Everything**, all ~6,900 URLs incl. archived versions | Algolia DocSearch crawler only | No — pointed at explicitly in the crawler config |

Both are emitted by `@docusaurus/plugin-sitemap`: the preset's default instance
owns `/sitemap.xml`, and a second instance (`id: 'algolia'`) in the `plugins`
array owns `/sitemap-algolia.xml`. See the comments in `docusaurus.config.js`.

## Why two

`static/robots.txt` disallows the archived version trees (`/docs/4.*/`,
`/docs/3.*/`, `/docs/2.5/`) for every user-agent. Listing those same URLs in the
public sitemap contradicts that — it tells crawlers "index these" and "don't
fetch these" at once, which surfaces in Search Console as *Indexed, though
blocked by robots.txt*.

They were in the public sitemap for one reason: Algolia. Search is supported for
every version, and the sitemap was the crawler's ground truth. That conflict only
existed because both audiences shared one file. The Algolia crawler config takes
an explicit `sitemaps: [...]` list, so it can read a file of its own.

A secondary benefit: agent-readiness checkers (afdocs.dev) sample pages from the
**head** of `/sitemap.xml`, not uniformly at random. Docusaurus emits archived
versions first, so ~5,800 twin-less URLs sat ahead of the first page with a
Markdown twin, and `content-negotiation` failed 0/50 while CloudFront was in fact
working. See `scripts/check-sitemap-markdown-coverage.js`.

## Rollout status

- [x] **Step 1 — emit `/sitemap-algolia.xml`.** Additive; `/sitemap.xml` still
      lists every version, so search cannot break regardless of crawler config.
- [x] **Step 2 — repoint the Algolia crawler** (manual, in the hosted Algolia
      Crawler admin — not a file in this repo). Done 2026-08-05.
- [x] **Step 3 — trim `/sitemap.xml` to the current version.** Done 2026-08-05,
      after step 1 was deployed to prod and `/sitemap-algolia.xml` verified live
      with all 6,932 URLs including 5,796 archived.

Rollout complete. The guard below now enforces the end state.

### Step 2: the crawler config change

In the Algolia Crawler editor for the StarRocks docs crawler:

```js
new Crawler({
  // ...
  sitemaps: ["https://docs.starrocks.io/sitemap-algolia.xml"],
  // ...
});
```

**One entry, deliberately — do not add `/sitemap.xml` as a fallback.** Listing
both would make the crawler resilient to `/sitemap-algolia.xml` disappearing,
which sounds good and isn't: the crawl would quietly succeed off the fallback and
nobody would learn that a deploy had dropped the file. A single entry means a
missing file fails the crawl, the failure sends a notification, and a failed
crawl is not written to the index — so the breakage is loud and harmless instead
of silent. (Decision: Dan, 2026-08-05.)

This rests on a failed sitemap fetch actually failing the crawl rather than
degrading to `startUrls` link-following, which would write a partial index. Worth
confirming against a deliberately bad URL once crawler logging is enabled.

Nothing in the build can silently remove the file: the guard below aborts the
build when `sitemap-algolia.xml` is missing, and it runs *before* the S3 sync, so
a broken build leaves the deployed file untouched.

Staging has its own copy at `https://docs-stage.starrocks.io/sitemap-algolia.xml`
if a separate staging crawler exists.

Note that `ignoreRobotsTxtRules: true` in the crawler config already exempts
Algolia from the `Disallow` rules; the `User-Agent: Algolia Crawler / Allow: /`
block in `static/robots.txt` is belt-and-braces and can stay.

**Verify before step 3:** trigger a recrawl and confirm the index still contains
records for archived versions — e.g. that a search for a term only present in an
older version still returns a `/docs/3.1/…` or `/docs/4.0/…` URL. If archived
records vanish, the crawler is not reading the new sitemap; fix that before
trimming.

### Step 3: the trim (done)

`ignorePatterns` on the **preset's** sitemap options — the default instance, not
the `algolia` one:

```js
sitemap: {
  ignorePatterns: archivedVersions.map((v) => `/docs/${v}/**`),
  createSitemapItems: /* kept — still sorts nav stubs last */,
},
```

`createSitemapItems` stays. Trimming empties the archived tier, but the ~90
auto-generated `/docs/category/**` stubs still cluster alphabetically near the
front of what remains; without the sort the head of the sitemap goes back to
~59% twin-less.

The `algolia` instance must never get `ignorePatterns` — it is now the only file
that lists the archived trees.

Resulting sizes: `/sitemap.xml` 1,136 URLs (1,040 with a Markdown twin, 96
navigation stubs), `/sitemap-algolia.xml` 6,932.

## Guard

`scripts/check-sitemap-markdown-coverage.js` runs after every build (`build.sh`
and both deploy workflows) and fails if:

- any archived-version URL appears in `/sitemap.xml`;
- fewer than 90% of those first 100 have a Markdown twin;
- `/sitemap-algolia.xml` is missing, or is not a superset of `/sitemap.xml`;
- `/sitemap-algolia.xml` contains no archived-version URLs.

The last two are what make step 3 safe: a trim that accidentally removes archived
versions from *both* files fails the build instead of silently gutting search.

## When a new version ships

`lastVersion`, `includedVersions` and `archivedVersions` are defined together at
the top of `docusaurus.config.js`; the sitemap tiers derive from them. Rolling a
release means updating `lastVersion` — if you don't, the new current version is
treated as archived and sorted to the back. The guard catches this.
