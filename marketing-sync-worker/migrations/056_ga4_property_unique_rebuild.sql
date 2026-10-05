-- MildMate Migration 056 (DB-only safety rebuild)
-- Purpose:
--   Rebuild ga4_funnel_daily so UNIQUE key includes property_id
--   while preserving all existing rows/IDs and recreating GA4 views.
--
-- IMPORTANT:
--   - This script is prepared only. Do NOT execute until explicitly approved.
--   - Keep human approval gates at:
--       (A) before migration starts
--       (B) after full completion + post-validation
--   - There are no manual pause points in the destructive section.

/* ============================================================
   PRE-MIGRATION READ-ONLY CHECKS (safe to run ahead of migration)
   ============================================================ */

-- Dependency preflight (authoritative scan requested)
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE sql LIKE '%ga4_funnel_daily%'
ORDER BY type, name;

-- Baseline row/stats snapshot
SELECT
  COUNT(*) AS rows_n,
  COALESCE(SUM(sessions), 0) AS sessions,
  COALESCE(SUM(users), 0) AS users,
  COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
  COALESCE(SUM(product_views), 0) AS product_views,
  COALESCE(SUM(add_to_cart), 0) AS add_to_cart,
  COALESCE(SUM(begin_checkout), 0) AS begin_checkout,
  COALESCE(SUM(purchases), 0) AS purchases,
  COALESCE(SUM(COALESCE(purchase_revenue, 0)), 0) AS revenue
FROM ga4_funnel_daily;

-- Current table DDL + indexes/triggers
SELECT sql FROM sqlite_master WHERE type='table' AND name='ga4_funnel_daily';
SELECT name, type, sql
FROM sqlite_master
WHERE tbl_name='ga4_funnel_daily' AND type IN ('index', 'trigger')
ORDER BY type, name;

-- Current property distribution + null checks
SELECT property_scope, COUNT(*) AS rows_n
FROM ga4_funnel_daily
GROUP BY property_scope
ORDER BY property_scope;

SELECT property_id, COUNT(*) AS rows_n
FROM ga4_funnel_daily
GROUP BY property_id
ORDER BY property_id;

SELECT
  SUM(CASE WHEN property_id IS NULL THEN 1 ELSE 0 END) AS null_property_id_rows,
  SUM(CASE WHEN property_scope IS NULL THEN 1 ELSE 0 END) AS null_property_scope_rows
FROM ga4_funnel_daily;

-- New unique-key duplicate preflight (must be zero rows before rebuild)
SELECT report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device, COUNT(*) AS dup_n
FROM ga4_funnel_daily
GROUP BY report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device
HAVING COUNT(*) > 1;

-- D1-supported FK checks (supported in current environment)
PRAGMA foreign_keys;
PRAGMA foreign_key_check;

-- Note:
-- PRAGMA integrity_check is intentionally excluded from required checks here,
-- because current D1 auth policy may reject it (SQLITE_AUTH in this environment).

/* ============================================================
   CONTINUOUS MIGRATION OPERATION (do not interrupt manually)
   ============================================================ */

DROP VIEW IF EXISTS analysis_ga4_daily;
DROP VIEW IF EXISTS analysis_ga4_page_daily;
DROP VIEW IF EXISTS analysis_ga4_product_daily;
DROP VIEW IF EXISTS analysis_ga4_product_28d;
DROP VIEW IF EXISTS analysis_ga4_freshness;
DROP VIEW IF EXISTS analysis_ga4_freshness_etsy;
DROP VIEW IF EXISTS analysis_ga4_etsy_daily;
DROP VIEW IF EXISTS analysis_ga4_etsy_listing_28d;

CREATE TABLE ga4_funnel_daily_rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  property_id TEXT NOT NULL DEFAULT '366290587',
  property_scope TEXT NOT NULL DEFAULT 'website',
  landing_page_path TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  begin_checkout INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_revenue REAL,
  product_id INTEGER,
  listing_id TEXT,
  mapping_scope TEXT NOT NULL DEFAULT 'non_product',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device)
);

-- Preserve ALL row values and primary IDs exactly.
INSERT INTO ga4_funnel_daily_rebuilt (
  id, report_date, property_id, property_scope,
  landing_page_path, page_path, source, medium, campaign, country, device,
  sessions, users, engaged_sessions, product_views, add_to_cart, begin_checkout,
  purchases, purchase_revenue, product_id, listing_id, mapping_scope,
  source_updated_at, created_at, updated_at
)
SELECT
  id, report_date, property_id, property_scope,
  landing_page_path, page_path, source, medium, campaign, country, device,
  sessions, users, engaged_sessions, product_views, add_to_cart, begin_checkout,
  purchases, purchase_revenue, product_id, listing_id, mapping_scope,
  source_updated_at, created_at, updated_at
FROM ga4_funnel_daily;

DROP TABLE ga4_funnel_daily;
ALTER TABLE ga4_funnel_daily_rebuilt RENAME TO ga4_funnel_daily;

CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_date ON ga4_funnel_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_product_date ON ga4_funnel_daily(product_id, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_landing_date ON ga4_funnel_daily(landing_page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_page_date ON ga4_funnel_daily(page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_scope_date ON ga4_funnel_daily(property_scope, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_listing_date ON ga4_funnel_daily(listing_id, report_date);

-- View recreation SQL aligned to migration 055 definitions.
DROP VIEW IF EXISTS analysis_ga4_daily;
CREATE VIEW analysis_ga4_daily AS
SELECT
  g.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT g.landing_page_path) AS landing_pages,
  COUNT(DISTINCT g.page_path) AS page_paths,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
  END AS engagement_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.sessions ELSE 0 END) AS mapped_sessions,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.product_views ELSE 0 END) AS mapped_product_views
FROM ga4_funnel_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
  AND g.landing_page_path NOT LIKE '%/listing/%'
GROUP BY g.report_date;

DROP VIEW IF EXISTS analysis_ga4_page_daily;
CREATE VIEW analysis_ga4_page_daily AS
SELECT
  g.report_date,
  g.landing_page_path,
  g.page_path,
  g.product_id,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct
FROM ga4_funnel_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
  AND g.landing_page_path NOT LIKE '%/listing/%'
GROUP BY g.report_date, g.landing_page_path, g.page_path, g.product_id;

DROP VIEW IF EXISTS analysis_ga4_product_daily;
CREATE VIEW analysis_ga4_product_daily AS
SELECT
  g.report_date,
  g.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct
FROM ga4_funnel_daily g
JOIN products p ON p.id = g.product_id
WHERE g.product_id IS NOT NULL
  AND g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
GROUP BY g.report_date, g.product_id, p.slug, p.title_en;

DROP VIEW IF EXISTS analysis_ga4_product_28d;
CREATE VIEW analysis_ga4_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.sessions, 0) AS sessions_28d,
  COALESCE(cur.product_views, 0) AS product_views_28d,
  COALESCE(cur.add_to_cart, 0) AS add_to_cart_28d,
  COALESCE(cur.begin_checkout, 0) AS begin_checkout_28d,
  COALESCE(cur.purchases, 0) AS purchases_28d,
  COALESCE(cur.purchase_revenue, 0) AS purchase_revenue_28d,
  COALESCE(prev.sessions, 0) AS sessions_prev_28d,
  COALESCE(prev.product_views, 0) AS product_views_prev_28d,
  COALESCE(prev.add_to_cart, 0) AS add_to_cart_prev_28d,
  COALESCE(prev.begin_checkout, 0) AS begin_checkout_prev_28d,
  COALESCE(prev.purchases, 0) AS purchases_prev_28d,
  COALESCE(prev.purchase_revenue, 0) AS purchase_revenue_prev_28d,
  CASE WHEN COALESCE(prev.sessions, 0) > 0
       THEN ROUND((COALESCE(cur.sessions, 0) - prev.sessions) * 100.0 / prev.sessions, 2)
  END AS sessions_growth_pct,
  CASE WHEN COALESCE(prev.purchases, 0) > 0
       THEN ROUND((COALESCE(cur.purchases, 0) - prev.purchases) * 100.0 / prev.purchases, 2)
  END AS purchases_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(sessions) AS sessions,
    SUM(product_views) AS product_views,
    SUM(add_to_cart) AS add_to_cart,
    SUM(begin_checkout) AS begin_checkout,
    SUM(purchases) AS purchases,
    SUM(COALESCE(purchase_revenue, 0)) AS purchase_revenue
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(sessions) AS sessions,
    SUM(product_views) AS product_views,
    SUM(add_to_cart) AS add_to_cart,
    SUM(begin_checkout) AS begin_checkout,
    SUM(purchases) AS purchases,
    SUM(COALESCE(purchase_revenue, 0)) AS purchase_revenue
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;

DROP VIEW IF EXISTS analysis_ga4_freshness;
CREATE VIEW analysis_ga4_freshness AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily WHERE property_scope = 'website') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily WHERE property_scope = 'website') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily WHERE property_scope = 'website') AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;

CREATE VIEW IF NOT EXISTS analysis_ga4_freshness_etsy AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS total_rows,
  (SELECT COUNT(DISTINCT listing_id) FROM ga4_funnel_daily
    WHERE property_scope = 'etsy' AND listing_id IS NOT NULL) AS distinct_listings,
  (SELECT SUM(CASE WHEN product_id IS NOT NULL THEN sessions ELSE 0 END) FROM ga4_funnel_daily
    WHERE property_scope = 'etsy') AS mapped_sessions,
  (SELECT SUM(sessions) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS total_sessions,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;

CREATE VIEW IF NOT EXISTS analysis_ga4_etsy_daily AS
SELECT
  g.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT g.listing_id) AS listings,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(CASE WHEN g.listing_id IS NOT NULL THEN g.sessions ELSE 0 END) AS listing_sessions,
  SUM(CASE WHEN m.product_id IS NOT NULL THEN g.sessions ELSE 0 END) AS mapped_sessions
FROM ga4_funnel_daily g
LEFT JOIN etsy_listing_master m ON m.listing_id = g.listing_id
WHERE g.property_scope = 'etsy'
  AND g.report_date IS NOT NULL AND length(g.report_date) = 10
GROUP BY g.report_date;

CREATE VIEW IF NOT EXISTS analysis_ga4_etsy_listing_28d AS
SELECT
  g.listing_id,
  m.product_id AS product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(g.sessions) AS sessions_28d,
  SUM(g.users) AS users_28d,
  SUM(g.engaged_sessions) AS engaged_sessions_28d,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
  END AS engagement_rate_pct
FROM ga4_funnel_daily g
JOIN etsy_listing_master m ON m.listing_id = g.listing_id
LEFT JOIN products p ON p.id = m.product_id
WHERE g.property_scope = 'etsy'
  AND g.listing_id IS NOT NULL
  AND g.report_date >= date('now', '-28 day')
GROUP BY g.listing_id, m.product_id, p.slug, p.title_en;

/* ============================================================
   POST-MIGRATION VALIDATION (run immediately after completion)
   ============================================================ */

-- Contract checks
SELECT sql FROM sqlite_master WHERE type='table' AND name='ga4_funnel_daily';
PRAGMA index_list(ga4_funnel_daily);
PRAGMA index_info('sqlite_autoindex_ga4_funnel_daily_1');

-- Business baseline preservation checks
SELECT
  COUNT(*) AS rows_n,
  COALESCE(SUM(sessions), 0) AS sessions,
  COALESCE(SUM(users), 0) AS users,
  COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
  COALESCE(SUM(product_views), 0) AS product_views,
  COALESCE(SUM(add_to_cart), 0) AS add_to_cart,
  COALESCE(SUM(begin_checkout), 0) AS begin_checkout,
  COALESCE(SUM(purchases), 0) AS purchases,
  COALESCE(SUM(COALESCE(purchase_revenue, 0)), 0) AS revenue
FROM ga4_funnel_daily;

WITH actual AS (
  SELECT
    COUNT(*) AS rows_n,
    COALESCE(SUM(sessions), 0) AS sessions,
    COALESCE(SUM(users), 0) AS users,
    COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
    COALESCE(SUM(product_views), 0) AS product_views,
    COALESCE(SUM(add_to_cart), 0) AS add_to_cart,
    COALESCE(SUM(begin_checkout), 0) AS begin_checkout,
    COALESCE(SUM(purchases), 0) AS purchases,
    COALESCE(SUM(COALESCE(purchase_revenue, 0)), 0) AS revenue
  FROM ga4_funnel_daily
),
expected AS (
  SELECT
    940 AS rows_n,
    1096 AS sessions,
    1051 AS users,
    254 AS engaged_sessions,
    14 AS product_views,
    3 AS add_to_cart,
    0 AS begin_checkout,
    0 AS purchases,
    0 AS revenue
)
SELECT
  a.*,
  CASE
    WHEN a.rows_n = e.rows_n
     AND a.sessions = e.sessions
     AND a.users = e.users
     AND a.engaged_sessions = e.engaged_sessions
     AND a.product_views = e.product_views
     AND a.add_to_cart = e.add_to_cart
     AND a.begin_checkout = e.begin_checkout
     AND a.purchases = e.purchases
     AND a.revenue = e.revenue
    THEN 'PASS'
    ELSE 'FAIL'
  END AS baseline_check
FROM actual a
CROSS JOIN expected e;

-- Property distribution + null checks
SELECT property_scope, COUNT(*) AS rows_n
FROM ga4_funnel_daily
GROUP BY property_scope
ORDER BY property_scope;

SELECT property_id, COUNT(*) AS rows_n
FROM ga4_funnel_daily
GROUP BY property_id
ORDER BY property_id;

SELECT
  SUM(CASE WHEN property_id IS NULL THEN 1 ELSE 0 END) AS null_property_id_rows,
  SUM(CASE WHEN property_scope IS NULL THEN 1 ELSE 0 END) AS null_property_scope_rows
FROM ga4_funnel_daily;

-- New unique-key duplicate check (must return zero rows)
SELECT report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device, COUNT(*) AS dup_n
FROM ga4_funnel_daily
GROUP BY report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device
HAVING COUNT(*) > 1;

-- AUTOINCREMENT validation: require sqlite_sequence.seq >= MAX(id)
SELECT MAX(id) AS max_id FROM ga4_funnel_daily;
SELECT name, seq FROM sqlite_sequence WHERE name = 'ga4_funnel_daily';
WITH mx AS (
  SELECT COALESCE(MAX(id), 0) AS max_id FROM ga4_funnel_daily
),
sq AS (
  SELECT COALESCE(MAX(seq), 0) AS seq FROM sqlite_sequence WHERE name = 'ga4_funnel_daily'
)
SELECT
  mx.max_id,
  sq.seq,
  CASE WHEN sq.seq >= mx.max_id THEN 'PASS' ELSE 'FAIL' END AS autoincrement_check
FROM mx, sq;

-- Executable checks for all 8 GA4 views
SELECT 'analysis_ga4_daily' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_daily;
SELECT 'analysis_ga4_page_daily' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_page_daily;
SELECT 'analysis_ga4_product_daily' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_product_daily;
SELECT 'analysis_ga4_product_28d' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_product_28d;
SELECT 'analysis_ga4_freshness' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_freshness;
SELECT 'analysis_ga4_freshness_etsy' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_freshness_etsy;
SELECT 'analysis_ga4_etsy_daily' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_etsy_daily;
SELECT 'analysis_ga4_etsy_listing_28d' AS view_name, COUNT(*) AS rows_n FROM analysis_ga4_etsy_listing_28d;

-- D1-supported FK checks post-migration
PRAGMA foreign_keys;
PRAGMA foreign_key_check;
