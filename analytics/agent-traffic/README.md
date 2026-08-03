# Agent traffic analysis

Answers one question: **is anyone actually using the Markdown and `llms.txt` we
publish for AI agents?**

The docs site's existing analytics cannot answer it. GA4 and PostHog both fire
from browser JavaScript; agents run none, and `.md` / `llms.txt` are not HTML
documents so they cannot carry a beacon regardless. CloudFront access logs are
the only instrument that sees this traffic.

- **Getting the logs:** [`../../cloudfront/LOGGING.md`](../../cloudfront/LOGGING.md)
  — the configuration request, including the privacy-preserving field selection.
- **Analysis:** StarRocks, reading the Parquet logs straight from S3 via the
  `FILES()` table function. No Glue crawler, no Athena.

## Privacy constraints

The logs are configured to contain **no IP addresses, no cookies, and no client
identifier of any kind** — see the field table in `LOGGING.md`. With no IP and no
cookie there is no key on which two requests could be joined, so no session,
visitor, or profile can be reconstructed. Raw logs expire from S3 after 30 days;
only aggregates persist here.

Two rules that keep it that way:

1. **Never add an identifying field** to the log configuration to "improve" a
   query. If a question needs one, the answer is that we do not ask it.
2. **Strip query strings from `referer`** on ingest (`schema.sql` does this).
   Referers from the docs site are benign, but external referers can carry
   search terms.

## Running it

Requires a StarRocks cluster with S3 read access to the log bucket — an instance
profile if the cluster runs in AWS, otherwise a read-only key scoped to that one
bucket. A single-node StarRocks in Docker is plenty for a monthly report.

```
1. Follow schema.sql top to bottom:
     - DESC FILES(...)          confirm connectivity and the real column names
     - CREATE TABLE ...         the normalized native table
     - INSERT INTO ... FILES()  load a month
2. Run queries.sql.
```

**Do the `DESC FILES(...)` step first and actually read the output.** CloudFront's
Parquet column naming is not assumed correct in `schema.sql` — the `INSERT` has a
clearly marked mapping section to correct against what `DESC` reports. Doing this
also serves as the privacy check: confirm no IP, cookie, or header-blob column
appears in the log data. If one does, the field selection did not apply and the
logging should be reconfigured before querying anything.

## What the queries tell you

| Query | Question |
|---|---|
| 1 | Asset mix over time — the headline `.md` vs HTML vs `llms.txt` number |
| 2 | Which agents: Anthropic, OpenAI, Perplexity, scripted tools, browsers |
| 3 | Human vs agent Markdown fetches — measures the in-page control's adoption |
| 4 | Which pages agents want most — feeds doc priorities |
| 5 | `llms.txt` traversal depth — validates the progressive-disclosure split |
| 6 | 4xx on `.md` paths — catches exclusion-list drift |
| 7 | Content negotiation reach — only if the optional `?via=accept` marker is on |

## Interpreting the result

- **Meaningful `.md` and `llms.txt` traffic** → the investment is landing, and a
  docs MCP server becomes the obvious next step (agents connect deliberately
  rather than stumbling in, and connection counts are directly measurable).
- **Near-zero** → the gap is discovery, not infrastructure. The assets exist and
  score well; nobody knows about them. Promotion, not more plumbing.

Either way this is worth writing up publicly — "how we measured AI agent traffic
to our docs, using StarRocks" is a post that dogfoods the product on real data
*and* promotes the Markdown endpoints it is measuring.
