# CloudFront access logging for agent-traffic measurement

**What this is:** a request to enable **CloudFront standard logging (v2)** on the
`docs.starrocks.io` distribution, writing privacy-preserving access logs to S3 in
Parquet so we can answer one question we currently cannot answer at all:

> Is anyone actually using the Markdown and `llms.txt` we publish for AI agents?

Like [`README.md`](./README.md), this is a runbook for whoever has AWS access to
the distribution. Unlike that one, **this change is additive and zero-risk**: it
does not touch the request path, cannot alter or break a response, and needs no
staging validation. It can go straight to production.

---

## Why the site's existing analytics cannot answer this

The docs site runs GA4 (`docusaurus.config.js`) and PostHog
(`src/components/Feedback/Feedback.tsx`). Both fire from browser JavaScript.

- **Agents do not execute JavaScript.** Agent traffic is not merely
  undercounted by these tools — it is structurally invisible, always zero.
- **`.md`, `llms.txt`, and `llms-full.txt` are not HTML documents.** They cannot
  load an analytics beacon even when a browser fetches them. Every asset the
  site publishes for agents sits in a blind spot.
- **Human traffic is undercounted too.** A developer audience blocks trackers at
  a high rate, and Safari/Brave restrictions and consent declines remove more.

Edge access logs are generated before any of that applies, so they see 100% of
requests. This is the only instrument that can measure the work in
`scripts/llms-postprocess.js`, `src/plugins/agent-friendly-docs.js`, and
`viewer-request-markdown.js`.

---

## Privacy: what we deliberately do NOT log

Standard logging v2 supports **per-field selection**, and AWS documents omitting
`c-ip` for exactly this reason. The configuration below logs **no IP address, no
cookies, and no client identifier of any kind**.

### Log these fields — and only these

| Field | Why |
|---|---|
| `timestamp` | when |
| `cs-uri-stem` | which page/asset — the core signal (`.md` vs HTML vs `llms.txt`) |
| `cs-method` | separate GET from HEAD probes |
| `sc-status` | catch 404s on `.md` paths (exclusion-list drift) |
| `sc-content-type` | confirm `text/markdown` is actually being served |
| `sc-bytes` | how much content agents pull |
| `cs(User-Agent)` | classify client: ClaudeBot / GPTBot / scripted tool / browser |
| `cs(Referer)` | distinguish a human clicking "Copy as Markdown" from an agent fetch |
| `x-edge-result-type` | cache hit/miss, so counts are read correctly |
| `x-host-header` | separate prod from any aliased hostname |

### Omit these fields

`c-ip`, `c-ip-version`, `cs(Cookie)`, `cs-headers`, `cs-header-names`,
`cs-headers-count`, `ssl-protocol`, `ssl-cipher`, `c-port`, `x-forwarded-for`,
and every other client-identifying field.

**Why this is genuinely anonymous, not just anonymized:** with no IP and no
cookie there is no key on which two requests can be joined. No session, visitor,
or profile can be reconstructed from this data even in principle. That is a
stronger guarantee than IP truncation or hashing, which are reversible-ish and
still support linkage.

Also add an S3 **lifecycle rule expiring raw logs after 30 days**. Aggregates
live on in StarRocks (`analytics/agent-traffic/`); the raw request rows do not
need to.

> Confirm the final field list with whoever owns the privacy policy before
> applying. Worth noting for that conversation: the site already loads
> `static/scripts/zoominfo.js`, a third-party visitor-**identification** service,
> on every page. IP-less first-party server logs are considerably less invasive
> than what is already running.

---

## Configuration to apply

**Distribution:** the production distribution in front of `docs.starrocks.io`
(`us-west-2`). Staging is optional and lower value — it receives no real agent
traffic, so it would prove nothing.

### 1. Log destination bucket

Create an S3 bucket, e.g. `starrocks-docs-cf-logs`, in `us-west-2`:

- Block all public access: **on**.
- Object Ownership: **Bucket owner enforced** (standard logging v2 delivers via
  AWS Logs Delivery and does not require ACLs).
- Lifecycle rule: expire objects after **30 days**.

### 2. Enable standard logging (v2)

CloudFront → the distribution → **Logging** tab → **Add** → **Amazon S3**:

| Setting | Value |
|---|---|
| Destination | `s3://starrocks-docs-cf-logs/` |
| Log file prefix | `cf-logs/{DistributionId}/` |
| Partitioning | `year={yyyy}/month={MM}/day={dd}/` |
| Hive-compatible file name/path | **enabled** |
| Output format | **Apache Parquet** |
| Fields | select exactly the ten in the table above; deselect everything else |

Hive-compatible paths plus Parquet is what lets StarRocks read the logs directly
via the `FILES()` table function — no Glue crawler and no Athena required.

### 3. Cost

- Log delivery to S3 carries **no CloudFront charge**.
- Parquet conversion incurs a small CloudWatch Logs charge (billed on data
  volume converted).
- S3 storage for a docs-site request volume, held 30 days, is negligible.

---

## Before you start: check what is already enabled

This may be partially configured already. Run first:

```bash
DIST_ID=<production-distribution-id>

# Legacy standard logging (v1) — configured on the distribution itself
aws cloudfront get-distribution-config --id "$DIST_ID" \
  --query 'DistributionConfig.Logging' --output json

# Standard logging v2 — configured as a CloudWatch Logs delivery, not on the
# distribution. Look for a delivery source whose resourceArn is this dist.
aws logs describe-delivery-sources --output table
aws logs describe-deliveries --output table
```

If legacy logging is already on, the ask becomes "migrate to v2 with field
selection" rather than "enable logging", and the legacy config should be turned
off afterwards so we are not paying to store IP addresses we do not want.

---

## Verification

About an hour after enabling, confirm objects are landing:

```bash
aws s3 ls s3://starrocks-docs-cf-logs/cf-logs/ --recursive | head
```

Expect Hive-style keys like:

```
cf-logs/E1234567890ABC/year=2026/month=08/day=03/<file>.parquet
```

Then, from StarRocks, confirm connectivity and the real column names before
writing any schema (see `analytics/agent-traffic/schema.sql`):

```sql
DESC FILES(
  "path" = "s3://starrocks-docs-cf-logs/cf-logs/<DIST_ID>/**/*.parquet",
  "format" = "parquet",
  "aws.s3.region" = "us-west-2",
  "aws.s3.access_key" = "<key>",
  "aws.s3.secret_key" = "<secret>"
);
```

**Privacy check — do this explicitly, do not assume:** confirm the returned
column list contains no IP, cookie, or header-blob field. If it does, the field
selection did not apply and the logging should be reconfigured before any data
is queried.

### While you are in this distribution: verify the Markdown function

This request is normally bundled with a redeploy of the content-negotiation
CloudFront Function (see [`README.md`](./README.md)). After that redeploy, run
the check below. It is the one that catches the failure mode that has already
happened once in production — the function published *without* its `EXCLUDED`
map, so every section index page returned 404 to any client asking for Markdown,
while browsers saw nothing wrong:

```bash
# Excluded index pages must stay HTML — a 404 here means EXCLUDED is missing
for r in loading/ administration/ sql-reference/sql-functions/ introduction/; do
  md=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/markdown' \
       "https://docs.starrocks.io/docs/$r")
  plain=$(curl -s -o /dev/null -w '%{http_code}' "https://docs.starrocks.io/docs/$r")
  printf '%-36s plain:%s markdown:%s%s\n' "$r" "$plain" "$md" \
    "$([ "$md" = 404 ] && [ "$plain" = 200 ] && echo '   <-- BROKEN')"
done
```

Expect `plain:200 markdown:200` on every line, with `content-type: text/html`.
The full sweep, and the reasoning behind it, is in `README.md`.

---

## Optional add-on (only if the Function is being redeployed anyway)

`viewer-request-markdown.js` rewrites `Accept: text/markdown` requests to the
`.md` twin. Because the rewrite happens before logging, a content-negotiated
request and a direct `.md` fetch look identical in the logs.

To tell them apart, the Function could append a marker query string when it
rewrites:

```js
request.uri = uri.substring(0, uri.length - 1) + '.md';
request.querystring = 'via=accept';
```

That shows up in `cs-uri-query` and separates "the agent sent an `Accept` header"
(content negotiation working) from "the agent fetched the `.md` URL directly"
(it read `llms.txt` or the in-page directive). Safe as long as the cache policy
does not include query strings in the cache key — **verify that before applying**,
since it would otherwise split the cache.

This is genuinely optional: it requires a second manual Function deploy, and
every query in `analytics/agent-traffic/queries.sql` works without it.

---

## Filing this

Open a GitHub issue in `StarRocks/doc-build` linking to this file, and **ping it
in Slack** — per the issue #60 experience, GitHub issues alone do not get seen.

Getting this person's attention is the scarce resource, so make it **one request
covering both CloudFront items**, and lead with the bug rather than the
enhancement:

1. **Redeploy the content-negotiation function** from
   `viewer-request-markdown.js` per [`README.md`](./README.md). This is a **live
   bug fix, not an enhancement**: the published function is missing its
   `EXCLUDED` map, so all ~19 section index pages return 404 to any client
   sending `Accept: text/markdown`. Verified broken on prod and staging. Then
   run the verification sweep above.
2. **Enable standard logging (v2)** as specified in this document.

Two facts make the logging half an easy approval:

- **Zero risk.** Logging does not touch the request path and cannot change a
  response. No staging round-trip needed.
- **More private than the status quo.** No IPs, no cookies, 30-day retention.

Both items from issue #60 — content negotiation and real 404s — are already
applied on prod and need no further action. Confirmed by:

```bash
curl -sI https://docs.starrocks.io/docs/this-page-does-not-exist/ | head -1
# HTTP/2 404   (not a soft 404 returning 200)
```
