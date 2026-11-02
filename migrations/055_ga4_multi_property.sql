-- MildMate Migration 055
-- Marketing Decision System — Multi-property GA4 (Phase 10 extension, owner-approved 2026-10-02)
-- Adds GA4 property identity to ga4_funnel_daily with property-aware uniqueness,
-- website-scoped versions of the existing views (zero semantic change), and
-- Etsy-scoped views for Etsy traffic/demand signals (Etsy API stays
-- authoritative for Etsy orders/revenue).
--
-- Properties (owner-approved):
--   366290587 = MildMate website  (property_scope 'website')
--   533944293 = Etsy Shop         (property_scope 'etsy')
--
-- Historical safety: ALL existing rows come from the website property only
-- (the collector never queried any other property; verified 2026-10-02 that
-- 100% of stored landing/page paths are mildmate.com paths). The ALTER
-- defaults below therefore tag every existing row correctly with no rewrite.

-- 1. Property identity columns (defaults tag existing rows as website).
ALTER TABLE ga4_funnel_daily ADD COLUMN property_id TEXT NOT NULL DEFAULT '366290587';
ALTER TABLE ga4_funnel_daily ADD COLUMN property_scope TEXT NOT NULL DEFAULT 'website';

-- 2. Etsy listing identity column (NULL for website rows). Extracted at
--    ingestion from deterministic /listing/{id} landing paths.
ALTER TABLE ga4_funnel_daily ADD COLUMN listing_id TEXT;

-- 3. Rebuild the table so the uniqueness key includes property_id
--    (properties can never overwrite each other). Row ids and all values
--    are preserved exactly. The existing views must be dropped first:
--    SQLite re-parses every schema object during ALTER TABLE ... RENAME and
--    aborts if a view still references the (transiently missing) table.
--    The views are recreated website-scoped in section 5 below.
DROP VIEW IF EXISTS analysis_ga4_daily;
DROP VIEW IF EXISTS analysis_ga4_page_daily;
DROP VIEW IF EXISTS analysis_ga4_product_daily;
DROP VIEW IF EXISTS analysis_ga4_product_28d;
DROP VIEW IF EXISTS analysis_ga4_freshness;

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
  purchases, purchase_revenue, product_id, NULL, mapping_scope,
  source_updated_at, created_at, updated_at
FROM ga4_funnel_daily;

DROP TABLE ga4_funnel_daily;
ALTER TABLE ga4_funnel_daily_rebuilt RENAME TO ga4_funnel_daily;

-- 4. Indexes (same as 048, plus property-scope indexes).
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_date ON ga4_funnel_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_product_date ON ga4_funnel_daily(product_id, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_landing_date ON ga4_funnel_daily(landing_page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_page_date ON ga4_funnel_daily(page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_scope_date ON ga4_funnel_daily(property_scope, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_listing_date ON ga4_funnel_daily(listing_id, report_date);

-- 5. Website-scoped views (same names; zero semantic change for the
--    dashboard and Phase 14). Website rows never contain Etsy /listing/
--    paths — the extra exclusion is a safeguard against any stray stream.

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

-- 6. Freshness: website view keeps the original name (dashboard + worker
--    compatibility) and matches the new per-property sync source plus the
--    legacy single-property source. Etsy gets its own independent view.
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

-- 7. Etsy-scope analytics: channel-level daily + per-listing 28d with
--    query-time product attribution (mapping activation retro-covers all
--    ingested Etsy rows; unmapped listings stay NULL, never zero).
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

-- 8. Model registry: v1 Demand sub-weights (owner amendment 2026-10-02).
--    GSC is too thin for 40% — GA4 80 / GSC 20 until coverage improves.
--    Stored in the versioned registry (no silent weight changes).
UPDATE opportunity_score_models
   SET weights_json = json_set(weights_json,
        '$.demand_ga4', 80,
        '$.demand_gsc', 20),
       updated_at = CURRENT_TIMESTAMP
 WHERE model_version = 'v1';
