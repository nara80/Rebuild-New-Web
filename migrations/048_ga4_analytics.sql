-- MildMate Migration 048
-- Marketing Decision System — Phase 10 (GA4 website behavior + funnel analytics)
-- Adds GA4 fact storage + analytical views. Additive only.

CREATE TABLE IF NOT EXISTS ga4_funnel_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
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
  mapping_scope TEXT NOT NULL DEFAULT 'non_product',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, landing_page_path, page_path, source, medium, campaign, country, device)
);

CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_date ON ga4_funnel_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_product_date ON ga4_funnel_daily(product_id, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_landing_date ON ga4_funnel_daily(landing_page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_daily_page_date ON ga4_funnel_daily(page_path, report_date);

-- Daily aggregate for website funnel behavior.
CREATE VIEW IF NOT EXISTS analysis_ga4_daily AS
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
GROUP BY g.report_date;

-- Landing/page daily aggregate with optional product mapping.
CREATE VIEW IF NOT EXISTS analysis_ga4_page_daily AS
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
GROUP BY g.report_date, g.landing_page_path, g.page_path, g.product_id;

-- Product-level daily aggregate (mapped product pages only).
CREATE VIEW IF NOT EXISTS analysis_ga4_product_daily AS
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
GROUP BY g.report_date, g.product_id, p.slug, p.title_en;

-- Funnel trend per product, current 28d vs previous 28d.
CREATE VIEW IF NOT EXISTS analysis_ga4_product_28d AS
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
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;

-- Freshness + sync health snapshot for GA4 collector.
CREATE VIEW IF NOT EXISTS analysis_ga4_freshness AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily) AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'ga4-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'ga4-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
