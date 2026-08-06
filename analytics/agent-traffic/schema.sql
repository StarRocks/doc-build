-- =============================================================================
-- Agent traffic: StarRocks schema and ingest for CloudFront access logs.
--
-- Prerequisite: standard logging (v2) enabled per ../../cloudfront/LOGGING.md,
-- writing Parquet with Hive-compatible paths to s3://starrocks-docs-cf-logs/.
--
-- Run this file top to bottom. Step 1 is not optional.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1. Confirm connectivity, and read the REAL column names.
--
-- CloudFront's Parquet column naming is not assumed correct below. Run this,
-- read the output, and correct the mapping in Step 4 to match.
--
-- This is also the privacy check: the column list must contain no IP, cookie,
-- or header-blob field. If it does, the field selection in LOGGING.md did not
-- apply — stop and reconfigure logging before querying anything.
-- -----------------------------------------------------------------------------
DESC FILES(
    "path"                = "s3://starrocks-docs-cf-logs/cf-logs/<DIST_ID>/**/*.parquet",
    "format"              = "parquet",
    "aws.s3.region"       = "us-west-2",
    -- In-AWS clusters: prefer the instance profile and drop the two keys below.
    --   "aws.s3.use_instance_profile" = "true",
    "aws.s3.access_key"   = "<key>",
    "aws.s3.secret_key"   = "<secret>"
);


-- -----------------------------------------------------------------------------
-- Step 2. Database.
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS docs_analytics;


-- -----------------------------------------------------------------------------
-- Step 3. Normalized request table.
--
-- Deliberately narrow: every column here is non-identifying. Do not extend this
-- table with client-identifying fields to make a query easier — see README.md.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docs_analytics.cf_requests (
    ts            DATETIME       NOT NULL           COMMENT "Request time (UTC)",
    uri           VARCHAR(2048)  NOT NULL           COMMENT "Path only, no query string",
    host          VARCHAR(255)                      COMMENT "x-host-header",
    method        VARCHAR(16)                       COMMENT "GET / HEAD / ...",
    status        SMALLINT                          COMMENT "HTTP status",
    content_type  VARCHAR(255)                      COMMENT "Response Content-Type",
    user_agent    VARCHAR(1024)                     COMMENT "Client UA, the agent signal",
    referer_host  VARCHAR(255)                      COMMENT "Referer host only; path+query dropped",
    from_docs     BOOLEAN                           COMMENT "Referer was a page on this site",
    edge_result   VARCHAR(64)                       COMMENT "Hit / Miss / RefreshHit / ...",
    bytes         BIGINT                            COMMENT "sc-bytes"
)
DUPLICATE KEY (ts, uri)
PARTITION BY date_trunc('day', ts)
DISTRIBUTED BY HASH (uri)
PROPERTIES (
    -- Raw logs expire from S3 after 30 days; keep a longer window here for
    -- trend work, and rely on the rollup MV in Step 6 for anything older.
    "replication_num" = "1"
);


-- -----------------------------------------------------------------------------
-- Step 4. Load.
--
-- Reads Parquet directly from S3. Narrow the glob to one month per run so a
-- re-run is cheap and re-loading a month is a matter of dropping its partitions
-- first (the table is DUPLICATE KEY, so re-running would otherwise duplicate).
--
-- >>> CORRECT THE SOURCE COLUMN NAMES BELOW AGAINST THE Step 1 OUTPUT. <<<
--     The right-hand side of each expression is the CloudFront field name; the
--     `AS` alias is what this repo's queries expect and should not change.
-- -----------------------------------------------------------------------------
INSERT INTO docs_analytics.cf_requests
SELECT
    -- CloudFront v2 emits an epoch timestamp; if Step 1 shows separate `date`
    -- and `time` string columns instead, use:
    --   CAST(CONCAT(`date`, ' ', `time`) AS DATETIME)
    FROM_UNIXTIME(CAST(`timestamp` AS BIGINT))                AS ts,

    `cs-uri-stem`                                             AS uri,
    `x-host-header`                                           AS host,
    `cs-method`                                               AS method,
    CAST(`sc-status` AS SMALLINT)                             AS status,
    `sc-content-type`                                         AS content_type,
    `cs-user-agent`                                           AS user_agent,

    -- Referer: keep the host only. External referers can carry search terms in
    -- the path/query, and we have no reason to store them.
    CASE
        WHEN `cs-referer` IS NULL OR `cs-referer` IN ('', '-') THEN NULL
        ELSE SPLIT_PART(SPLIT_PART(`cs-referer`, '://', 2), '/', 1)
    END                                                       AS referer_host,

    -- Did this request come from a link/control on our own docs site? This is
    -- how a human clicking "Copy as Markdown" is told apart from an agent fetch.
    CASE
        WHEN `cs-referer` IS NULL OR `cs-referer` IN ('', '-') THEN FALSE
        ELSE SPLIT_PART(SPLIT_PART(`cs-referer`, '://', 2), '/', 1)
             LIKE '%docs%.starrocks.io'
    END                                                       AS from_docs,

    `x-edge-result-type`                                      AS edge_result,
    CAST(`sc-bytes` AS BIGINT)                                AS bytes
FROM FILES(
    "path"                = "s3://starrocks-docs-cf-logs/cf-logs/<DIST_ID>/year=2026/month=08/**/*.parquet",
    "format"              = "parquet",
    "aws.s3.region"       = "us-west-2",
    "aws.s3.access_key"   = "<key>",
    "aws.s3.secret_key"   = "<secret>"
);


-- -----------------------------------------------------------------------------
-- Step 5. Sanity check the load before trusting any query.
-- -----------------------------------------------------------------------------
SELECT
    MIN(ts)                                      AS first_request,
    MAX(ts)                                      AS last_request,
    COUNT(*)                                     AS rows_loaded,
    COUNT(DISTINCT uri)                          AS distinct_uris,
    SUM(CASE WHEN uri LIKE '%.md' THEN 1 ELSE 0 END)      AS markdown_requests,
    SUM(CASE WHEN uri LIKE '%llms%.txt' THEN 1 ELSE 0 END) AS llms_txt_requests
FROM docs_analytics.cf_requests;


-- -----------------------------------------------------------------------------
-- Step 6. Optional: daily rollup so the recurring report is instant and can
-- outlive the raw rows.
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS docs_analytics.mv_daily_asset_mix
REFRESH ASYNC EVERY (INTERVAL 1 DAY)
AS
SELECT
    date_trunc('day', ts) AS day,
    CASE
        WHEN uri LIKE '%/llms-full.txt' THEN 'llms-full.txt'
        WHEN uri LIKE '%llms.txt'       THEN 'llms.txt'
        WHEN uri LIKE '%.md'            THEN 'markdown'
        WHEN uri LIKE '%/'              THEN 'html page'
        ELSE 'asset'
    END                   AS asset_kind,
    COUNT(*)              AS requests,
    SUM(bytes)            AS bytes
FROM docs_analytics.cf_requests
GROUP BY 1, 2;
