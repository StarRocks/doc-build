# CloudFront changes for agent-friendly docs

Two of the [afdocs.dev](https://afdocs.dev/) checks can only be fixed at the CDN
layer — they are not part of the Docusaurus build. These steps apply to the
**production** CloudFront distribution in front of the `docs.starrocks.io` S3
bucket (`us-west-2`). Apply the same to the staging distribution when ready.

> You need AWS Console or CLI access to the CloudFront distribution. Nothing
> here changes the S3 bucket contents — the `.md` files are already uploaded by
> the normal `aws s3 sync build/` step.

There are two independent fixes:

1. **Content negotiation** (`Accept: text/markdown`) — a CloudFront Function.
2. **Real 404s** (stop the soft-404 that returns HTTP 200 for missing pages) — a
   custom error response.

---

## 1. Content negotiation — CloudFront Function

**What it fixes:** the `content-negotiation` check. Agents (Claude Code, Cursor,
OpenCode) request `Accept: text/markdown`; today CloudFront ignores it and
returns HTML. The function below rewrites the request to the page's `.md` twin.

Source: [`viewer-request-markdown.js`](./viewer-request-markdown.js)

### Apply via Console

1. CloudFront → **Functions** → **Create function**.
   - Name: `docs-markdown-content-negotiation`
   - Runtime: **cloudfront-js-2.0**
2. Paste the contents of `viewer-request-markdown.js` into the **Development**
   tab and **Save changes**.
3. **Test** tab → set the request URI to `/docs/administration/cluster_snapshot/`
   and add a header `accept: text/markdown`. Run — confirm the output request
   URI is `/docs/administration/cluster_snapshot.md`. Then test with
   `accept: text/html` and confirm the URI is **unchanged**.
4. **Publish** tab → **Publish function**.
5. Distribution → **Behaviors** → edit the **Default (\*)** behavior →
   **Function associations** → **Viewer request** → select
   `docs-markdown-content-negotiation` → **Save changes**.

> If a viewer-request function is already associated with the behavior, merge
> this logic into it instead of attaching a second one — a behavior allows only
> one viewer-request function.

### Apply via CLI

```bash
DIST_ID=<your-distribution-id>

# Create + publish the function
aws cloudfront create-function \
  --name docs-markdown-content-negotiation \
  --function-config Comment="Serve .md on Accept: text/markdown",Runtime="cloudfront-js-2.0" \
  --function-code fileb://cloudfront/viewer-request-markdown.js

ETAG=$(aws cloudfront describe-function --name docs-markdown-content-negotiation \
  --query 'ETag' --output text)
aws cloudfront publish-function --name docs-markdown-content-negotiation --if-match "$ETAG"
```

Then associate it with the default behavior. The cleanest way is Console
(step 5 above). To do it via CLI, `aws cloudfront get-distribution-config`,
add a `FunctionAssociations` block with `EventType=viewer-request` and the
function ARN to `DefaultCacheBehavior`, and `update-distribution` with the
returned `--if-match` ETag.

### Notes

- The function only rewrites page routes (trailing slash) that actually have a
  `.md` twin: the latest doc version (`/docs/…`, no version prefix) and
  `/releasenotes/…`. Older versions (`/docs/4.0/`, `/docs/3.5/`, …) and the
  navigation/index routes excluded in `docusaurus.config.js` are left as HTML,
  so agents never get a 404 on a missing `.md`. If you change
  `markdown.excludeRoutes` in the config, update the `EXCLUDED` list in
  `viewer-request-markdown.js` to match.
- Because the rewrite happens before the cache lookup, HTML and Markdown cache
  under separate keys — no cache-key changes needed.
- **Content-Type:** the deploy workflows already re-upload `.md` files with
  `Content-Type: text/markdown; charset=utf-8` (a second `aws s3 cp` pass after
  the main `aws s3 sync`), so S3 serves them as a readable body rather than a
  download. No manual action needed — just confirm it in the verify step below.

---

## 2. Real 404s — custom error response

**What it fixes:** the `http-status-codes` check (soft 404). Today a request for
a non-existent page returns **HTTP 200** with page-shell content, so agents try
to extract information from an error page. We want a real **404**.

Docusaurus already builds a `/404.html`. The goal: when the origin (S3) can't
find an object, CloudFront serves `/404.html` **with status 404**, not 200.

### Apply via Console

Distribution → **Error pages** → **Create custom error response** (do this for
**both** 403 and 404 — S3 with Origin Access Control returns **403** for missing
keys, while the S3 *website* endpoint returns **404**):

| Setting | Value |
| --- | --- |
| HTTP error code | `404` (repeat for `403`) |
| Customize error response | **Yes** |
| Response page path | `/404.html` |
| **HTTP Response code** | **`404`** |
| Error caching minimum TTL | `10` (seconds; tune as desired) |

The critical field is **HTTP Response code = 404**. If an existing rule maps
403/404 → `/index.html` with response code `200`, that is the soft-404 — change
its response code to `404` and point it at `/404.html`.

### Apply via CLI

Edit the distribution's `CustomErrorResponses` array (via
`get-distribution-config` → edit → `update-distribution`) to include:

```json
{
  "Quantity": 2,
  "Items": [
    { "ErrorCode": 404, "ResponsePagePath": "/404.html", "ResponseCode": "404", "ErrorCachingMinTTL": 10 },
    { "ErrorCode": 403, "ResponsePagePath": "/404.html", "ResponseCode": "404", "ErrorCachingMinTTL": 10 }
  ]
}
```

> Verify no SPA-style rule remains that rewrites 403/404 to `/index.html` with a
> `200` response code — that rule is what produces the soft-404.

---

## Verify after deploy

Wait for the distribution to finish deploying (and invalidate `/*` if needed),
then:

```bash
# Content negotiation: should return Markdown, not HTML
curl -sSL -H 'Accept: text/markdown' \
  https://docs.starrocks.io/docs/administration/cluster_snapshot/ | head -5
# Expect the "> For the complete documentation index..." blockquote + Markdown.

# Real 404: should be HTTP/2 404, not 200
curl -sI https://docs.starrocks.io/docs/this-page-does-not-exist/ | head -1
# Expect: HTTP/2 404
```

### The check that actually matters — excluded routes must stay HTML

**Do not skip this one.** The first curl above passes even when the function's
`EXCLUDED` map is missing entirely, because it only proves that rewriting
happens. What it cannot show is whether rewriting is being *withheld* where it
should be — and that is the half that silently broke in production: every
section index page returned 404 to any client sending `Accept: text/markdown`,
while plain browsers saw nothing wrong.

Section index pages have no `.md` twin (see `src/agentDocsRoutes.js`), so the
function must pass them through as HTML:

```bash
# Excluded index page: must be 200 + text/html, NOT 404
curl -sI -H 'Accept: text/markdown' https://docs.starrocks.io/docs/loading/ \
  | grep -iE '^HTTP|content-type'
# Expect: HTTP/2 200  and  content-type: text/html
# A 404 here means EXCLUDED did not make it into the published function.
```

Sweep all of them at once — any line marked BROKEN means the deployed function
is out of sync with `viewer-request-markdown.js`:

```bash
for r in administration/ benchmarking/ faq/ integrations/ introduction/ \
         loading/ unloading/ project_help/ sql-reference/sql-functions/ \
         sql-reference/data-types/ sql-reference/sql-functions/date-time-functions/ \
         loading/objectstorage/ data_source/catalog/catalog_intro/; do
  md=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/markdown' \
       "https://docs.starrocks.io/docs/$r")
  plain=$(curl -s -o /dev/null -w '%{http_code}' "https://docs.starrocks.io/docs/$r")
  printf '%-44s plain:%s markdown:%s%s\n' "$r" "$plain" "$md" \
    "$([ "$md" = 404 ] && [ "$plain" = 200 ] && echo '   <-- BROKEN')"
done
```

Also confirm the version guard still holds, since it is the other way a bad
publish shows up:

```bash
# Older version has no .md twin: must stay HTML
curl -sI -H 'Accept: text/markdown' https://docs.starrocks.io/docs/4.0/quick_start/ \
  | grep -iE '^HTTP|content-type'
# Expect: HTTP/2 200  and  content-type: text/html
```

`scripts/check-cloudfront-excludes.js` keeps `viewer-request-markdown.js` in
sync with `src/agentDocsRoutes.js` at build time, but nothing in the repo can
see what is actually published to CloudFront. These curls are the only check
that closes that gap, so run them after **every** publish.

Re-run the afdocs scorecard to confirm `content-negotiation` and
`http-status-codes` now pass.
