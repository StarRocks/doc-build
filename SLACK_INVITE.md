# StarRocks Slack invite — `/join` runbook

The StarRocks Slack is on the **Pro** plan, where an invite link expires after
**~400 uses or 30 days**, whichever comes first. To avoid chasing raw Slack URLs
across the docs, website, and READMEs every time it rotates, everything points at
one stable URL:

> **https://docs.starrocks.io/join**

That page (`static/join/index.html`) redirects to the *current* Slack invite and
records each use in Google Analytics so we know when to rotate.

---

## Rotating the invite link (the routine task)

1. In Slack, generate a fresh invite link.
2. Edit **`static/join/index.html`** and replace the URL in the one tag:
   ```html
   <a id="invite" href="https://join.slack.com/t/REPLACE-WITH-CURRENT-INVITE">click here to join</a>
   ```
   That `href` is the **single source of truth** — the redirect script reads it.
   There is nothing else to change.
3. Commit on a branch and run the normal **prod deploy** workflow
   (`build → aws s3 sync → CloudFront invalidation`). The new link is live once
   the invalidation completes.

That's the whole "management" story: one line, then your existing publish.

---

## Knowing when to rotate (counting usage)

The redirect page fires a GA4 event named **`slack_invite_redirect`** on the docs
site's existing property (`G-VTBXVPZLHB`) right before sending the visitor to Slack.

**To read the count in GA4:**
- Reports → **Engagement → Events** → look for `slack_invite_redirect` (its
  *Event count*), or build an Exploration filtered to that event for a date range.

**Rotate at ~350 counted events**, not 400. GA undercounts slightly because some
visitors block analytics, so staying ~50 under the real limit keeps the link from
dying mid-use. (Bots, on the other hand, are filtered out by GA — so this count is
*cleaner* than a raw request count would be.)

**The 30-day rule** isn't usage-based, so it isn't counted — set a recurring
calendar reminder to rotate every 30 days regardless of the event count.

> Optional: in GA4 you can create a **custom insight / alert** that emails you when
> `slack_invite_redirect` crosses a daily or cumulative threshold, so you don't have
> to check manually.

### Why GA and not CloudFront logs?
Legacy CloudFront access logging is **off** on the prod distribution
(`Logging.Enabled = false`), and enabling it is owned by the infra team. GA4 is
already on every docs page, fully in our control via the static deploy, and filters
bots — so it's the better counter here, with no new infrastructure.

---

## Pointing things at `/join`

Replace raw `https://join.slack.com/...` links anywhere we control (docs pages,
website footer, GitHub READMEs, social profiles) with `https://docs.starrocks.io/join`.
After that, rotations never require touching those places again.

---

## Future: collecting signup info ("where do you work?")

Not built yet, but the design leaves the door open. `static/join/index.html` is a
real HTML page (not a bare 302), so it can later show a short form and **POST the
answers to a backend before redirecting** — without changing the `/join` URL or
breaking anything that links to it. A small AWS Lambda Function URL writing to
DynamoDB is the natural fit (deployable independently of CloudFront), and it could
double as the usage counter at that point.
