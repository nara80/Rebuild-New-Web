-- MildMate Migration 049
-- Marketing Decision System — Phase 11 (Etsy listing performance analytics)
-- Adds Etsy listing master + daily fact storage + analytical views. Additive only.

CREATE TABLE IF NOT EXISTS etsy_listing_master (
  listing_id TEXT PRIMARY KEY,
  shop_id TEXT,
  shop_name TEXT,
  listing_title TEXT NOT NULL DEFAULT '',
  listing_state TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  listing_url TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  price REAL,
  quantity_available INTEGER,
  views_total INTEGER,
  favorites_total INTEGER,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_etsy_listing_master_product ON etsy_listing_master(product_id);
CREATE INDEX IF NOT EXISTS idx_etsy_listing_master_active ON etsy_listing_master(is_active, listing_state);

CREATE TABLE IF NOT EXISTS etsy_listing_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  listing_title TEXT NOT NULL DEFAULT '',
  listing_state TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT '',
  visits INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  favorites INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  transactions INTEGER NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  revenue REAL,
  revenue_thb REAL,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES etsy_listing_master(listing_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, listing_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_etsy_listing_daily_date ON etsy_listing_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_etsy_listing_daily_listing_date ON etsy_listing_daily(listing_id, report_date);
CREATE INDEX IF NOT EXISTS idx_etsy_listing_daily_product_date ON etsy_listing_daily(product_id, report_date);

CREATE VIEW IF NOT EXISTS analysis_etsy_daily AS
SELECT
  e.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT e.listing_id) AS listings,
  COUNT(DISTINCT CASE WHEN e.is_active = 1 THEN e.listing_id END) AS active_listings,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue, 0)) AS revenue,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb,
  SUM(CASE WHEN e.product_id IS NOT NULL THEN e.views ELSE 0 END) AS mapped_views,
  SUM(CASE WHEN e.product_id IS NOT NULL THEN e.orders ELSE 0 END) AS mapped_orders
FROM etsy_listing_daily e
WHERE e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY e.report_date;

CREATE VIEW IF NOT EXISTS analysis_etsy_listing_daily AS
SELECT
  e.report_date,
  e.listing_id,
  e.listing_title,
  e.listing_state,
  e.is_active,
  e.currency,
  e.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue, 0)) AS revenue,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
FROM etsy_listing_daily e
LEFT JOIN products p ON p.id = e.product_id
WHERE e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY
  e.report_date, e.listing_id, e.listing_title, e.listing_state, e.is_active,
  e.currency, e.product_id, p.slug, p.title_en;

CREATE VIEW IF NOT EXISTS analysis_etsy_product_daily AS
SELECT
  e.report_date,
  e.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COUNT(DISTINCT e.listing_id) AS listing_count,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
FROM etsy_listing_daily e
JOIN products p ON p.id = e.product_id
WHERE e.product_id IS NOT NULL
  AND e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY e.report_date, e.product_id, p.slug, p.title_en;

CREATE VIEW IF NOT EXISTS analysis_etsy_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.listing_count, 0) AS listing_count_28d,
  COALESCE(cur.views, 0) AS views_28d,
  COALESCE(cur.favorites, 0) AS favorites_28d,
  COALESCE(cur.orders, 0) AS orders_28d,
  COALESCE(cur.transactions, 0) AS transactions_28d,
  COALESCE(cur.units_sold, 0) AS units_sold_28d,
  COALESCE(cur.revenue_thb, 0) AS revenue_thb_28d,
  COALESCE(prev.views, 0) AS views_prev_28d,
  COALESCE(prev.favorites, 0) AS favorites_prev_28d,
  COALESCE(prev.orders, 0) AS orders_prev_28d,
  COALESCE(prev.transactions, 0) AS transactions_prev_28d,
  COALESCE(prev.units_sold, 0) AS units_sold_prev_28d,
  COALESCE(prev.revenue_thb, 0) AS revenue_thb_prev_28d,
  CASE WHEN COALESCE(prev.views, 0) > 0
       THEN ROUND((COALESCE(cur.views, 0) - prev.views) * 100.0 / prev.views, 2)
  END AS views_growth_pct,
  CASE WHEN COALESCE(prev.orders, 0) > 0
       THEN ROUND((COALESCE(cur.orders, 0) - prev.orders) * 100.0 / prev.orders, 2)
  END AS orders_growth_pct,
  CASE WHEN COALESCE(prev.revenue_thb, 0) > 0
       THEN ROUND((COALESCE(cur.revenue_thb, 0) - prev.revenue_thb) * 100.0 / prev.revenue_thb, 2)
  END AS revenue_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    COUNT(DISTINCT listing_id) AS listing_count,
    SUM(views) AS views,
    SUM(favorites) AS favorites,
    SUM(orders) AS orders,
    SUM(transactions) AS transactions,
    SUM(units_sold) AS units_sold,
    SUM(COALESCE(revenue_thb, 0)) AS revenue_thb
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(views) AS views,
    SUM(favorites) AS favorites,
    SUM(orders) AS orders,
    SUM(transactions) AS transactions,
    SUM(units_sold) AS units_sold,
    SUM(COALESCE(revenue_thb, 0)) AS revenue_thb
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
    AND report_date < date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;

CREATE VIEW IF NOT EXISTS analysis_etsy_listing_status AS
SELECT
  COUNT(*) AS total_listings,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_listings,
  SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_listings,
  SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) AS mapped_listings,
  SUM(CASE WHEN product_id IS NULL THEN 1 ELSE 0 END) AS unmapped_listings,
  MAX(last_seen_at) AS last_listing_sync_at
FROM etsy_listing_master;

CREATE VIEW IF NOT EXISTS analysis_etsy_freshness AS
SELECT
  (SELECT MAX(report_date) FROM etsy_listing_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM etsy_listing_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM etsy_listing_daily) AS total_rows,
  (SELECT COUNT(*) FROM etsy_listing_master) AS total_master_listings,
  (SELECT SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM etsy_listing_master) AS active_master_listings,
  (SELECT SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) FROM etsy_listing_master) AS inactive_master_listings,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'etsy-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'etsy-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'etsy-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'etsy-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
