-- =============================================================================
-- Agent traffic: the questions worth asking.
--
-- Run schema.sql first. All queries read docs_analytics.cf_requests, which
-- contains no IP addresses, cookies, or client identifiers by design.
--
-- Reading these numbers: CloudFront caches, so a request count is a count of
-- requests reaching the edge, which is what we want — it is the demand signal,
-- not an origin-load signal.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. THE HEADLINE: what kind of asset is being requested, week over week.
--
-- `markdown` and `llms.txt` here are, almost by construction, agent traffic:
-- no human browses raw Markdown, and until the in-page "Copy as Markdown"
-- control shipped, nothing on the site even linked to it. Query 3 splits out
-- the human share now that the control exists.
-- -----------------------------------------------------------------------------
SELECT
    date_trunc('week', ts)                                   AS week,
    CASE
        WHEN uri LIKE '%/llms-full.txt' THEN 'llms-full.txt'
        WHEN uri LIKE '%llms.txt'       THEN 'llms.txt'
        WHEN uri LIKE '%.md'            THEN 'markdown'
        WHEN uri LIKE '%/'              THEN 'html page'
        ELSE 'static asset'
    END                                                      AS asset_kind,
    COUNT(*)                                                 AS requests,
    ROUND(SUM(bytes) / 1024 / 1024, 1)                       AS mb
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND status < 400
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;


-- -----------------------------------------------------------------------------
-- 2. WHO is asking. User-Agent classification.
--
-- The 'scripted / tool client' bucket is the interesting one: MCP servers,
-- coding agents, and CI jobs land there, and they are exactly the consumers the
-- Markdown was built for. Keep the patterns in this one CTE — new agents appear
-- constantly and this is the only place to add them.
-- -----------------------------------------------------------------------------
WITH classified AS (
    SELECT
        CASE
            WHEN user_agent LIKE '%ClaudeBot%'
              OR user_agent LIKE '%Claude-User%'
              OR user_agent LIKE '%Claude-SearchBot%'
              OR user_agent LIKE '%anthropic-ai%'          THEN 'Anthropic'
            WHEN user_agent LIKE '%GPTBot%'
              OR user_agent LIKE '%ChatGPT-User%'
              OR user_agent LIKE '%OAI-SearchBot%'         THEN 'OpenAI'
            WHEN user_agent LIKE '%PerplexityBot%'
              OR user_agent LIKE '%Perplexity-User%'       THEN 'Perplexity'
            WHEN user_agent LIKE '%Google-Extended%'
              OR user_agent LIKE '%GoogleOther%'
              OR user_agent LIKE '%Gemini%'                THEN 'Google AI'
            WHEN user_agent LIKE '%Bytespider%'
              OR user_agent LIKE '%Amazonbot%'
              OR user_agent LIKE '%Applebot%'
              OR user_agent LIKE '%meta-externalagent%'
              OR user_agent LIKE '%CCBot%'
              OR user_agent LIKE '%cohere%'
              OR user_agent LIKE '%DuckAssistBot%'
              OR user_agent LIKE '%YouBot%'                THEN 'Other AI crawler'
            WHEN user_agent LIKE '%Googlebot%'
              OR user_agent LIKE '%bingbot%'
              OR user_agent LIKE '%Algolia%'               THEN 'Search engine'
            WHEN user_agent LIKE '%python-requests%'
              OR user_agent LIKE '%httpx%'
              OR user_agent LIKE '%aiohttp%'
              OR user_agent LIKE '%node-fetch%'
              OR user_agent LIKE '%undici%'
              OR user_agent LIKE '%axios%'
              OR user_agent LIKE '%curl%'
              OR user_agent LIKE '%Wget%'
              OR user_agent LIKE '%Go-http-client%'
              OR user_agent LIKE '%okhttp%'
              OR user_agent IS NULL
              OR user_agent IN ('', '-')                   THEN 'Scripted / tool client'
            WHEN user_agent LIKE '%Mozilla%'               THEN 'Browser'
            ELSE 'Unclassified'
        END AS client,
        uri,
        status
    FROM docs_analytics.cf_requests
    WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      AND status < 400
)
SELECT
    client,
    COUNT(*)                                                          AS requests,
    SUM(CASE WHEN uri LIKE '%.md' THEN 1 ELSE 0 END)                  AS markdown,
    SUM(CASE WHEN uri LIKE '%llms%.txt' THEN 1 ELSE 0 END)            AS llms_txt,
    SUM(CASE WHEN uri LIKE '%/' THEN 1 ELSE 0 END)                    AS html,
    ROUND(100.0 * SUM(CASE WHEN uri LIKE '%.md' OR uri LIKE '%llms%.txt'
                           THEN 1 ELSE 0 END) / COUNT(*), 1)          AS pct_agent_format
FROM classified
GROUP BY client
ORDER BY requests DESC;


-- -----------------------------------------------------------------------------
-- 3. Human vs agent Markdown fetches.
--
-- A .md request carrying a docs Referer came from the in-page "Copy as
-- Markdown" control (src/components/MarkdownActions). No Referer means an agent
-- fetched the URL directly — from llms.txt, the in-page directive, or content
-- negotiation.
--
-- This is the authoritative adoption number for the in-page control. The GA4
-- `markdown_action` events measure the same thing but are blocked for a large
-- share of a developer audience, so treat those as a floor and this as truth.
-- -----------------------------------------------------------------------------
SELECT
    date_trunc('week', ts)                                   AS week,
    CASE WHEN from_docs THEN 'human — in-page control'
         ELSE 'agent — direct fetch' END                     AS source,
    COUNT(*)                                                 AS markdown_requests,
    COUNT(DISTINCT uri)                                      AS distinct_pages
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND uri LIKE '%.md'
  AND status < 400
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;


-- -----------------------------------------------------------------------------
-- 4. WHAT agents want. Top pages fetched as Markdown.
--
-- Compare against the equivalent HTML ranking: pages that rank far higher in
-- Markdown than in HTML are the ones agents are being asked about, and are
-- worth prioritizing for accuracy and structure.
-- -----------------------------------------------------------------------------
SELECT
    uri,
    COUNT(*)                                                 AS md_requests,
    SUM(CASE WHEN from_docs THEN 0 ELSE 1 END)               AS agent_requests,
    ROUND(AVG(bytes) / 1024, 0)                              AS avg_kb
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND uri LIKE '%.md'
  AND status < 400
GROUP BY uri
ORDER BY md_requests DESC
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 5. Is the llms.txt split earning its keep?
--
-- scripts/llms-postprocess.js splits llms.txt into a root index plus per-section
-- files (progressive disclosure). That only pays off if agents actually follow
-- the links. If section files are never fetched, agents are stopping at the
-- root index and the split is costing a hop for nothing.
-- -----------------------------------------------------------------------------
SELECT
    CASE
        WHEN uri = '/llms.txt'          THEN '1. root index'
        WHEN uri = '/llms-full.txt'     THEN '0. llms-full.txt (bulk/RAG)'
        ELSE '2. section index'
    END                                                      AS level,
    COUNT(*)                                                 AS requests,
    COUNT(DISTINCT uri)                                      AS distinct_files
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND uri LIKE '%llms%.txt'
  AND status < 400
GROUP BY 1
ORDER BY 1;

-- ...and which sections get traversed.
SELECT
    uri                                                      AS section_index,
    COUNT(*)                                                 AS requests
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND uri LIKE '%llms.txt'
  AND uri <> '/llms.txt'
  AND status < 400
GROUP BY uri
ORDER BY requests DESC
LIMIT 30;


-- -----------------------------------------------------------------------------
-- 6. Health: 4xx on Markdown paths.
--
-- Non-zero means something asked for a .md that does not exist — usually drift
-- between the exclusion list in src/agentDocsRoutes.js and the EXCLUDED map in
-- cloudfront/viewer-request-markdown.js (scripts/check-cloudfront-excludes.js
-- guards this at build time), or a stale link in a cached llms.txt.
-- -----------------------------------------------------------------------------
SELECT
    uri,
    status,
    COUNT(*)                                                 AS requests,
    MAX(ts)                                                  AS last_seen
FROM docs_analytics.cf_requests
WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND uri LIKE '%.md'
  AND status >= 400
GROUP BY uri, status
ORDER BY requests DESC
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 7. Content negotiation reach.
--
-- Only meaningful if the optional `?via=accept` marker described at the end of
-- cloudfront/LOGGING.md has been applied to the CloudFront Function AND the
-- schema keeps the query string. Without it, a negotiated request and a direct
-- .md fetch are indistinguishable — which is fine; queries 1-4 still work.
--
-- Left here as the query to run if that marker is ever turned on.
-- -----------------------------------------------------------------------------
-- SELECT
--     CASE WHEN query LIKE '%via=accept%'
--          THEN 'sent Accept: text/markdown'
--          ELSE 'fetched the .md URL directly' END           AS discovery_path,
--     COUNT(*)                                               AS requests
-- FROM docs_analytics.cf_requests
-- WHERE ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
--   AND uri LIKE '%.md'
--   AND status < 400
-- GROUP BY 1;
