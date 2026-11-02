-- MildMate Migration 046
-- Marketing Decision System — Phase 09 (Google Search Console analytics)
-- Adds GSC fact storage + analytical views. Additive only.

CREATE TABLE IF NOT EXISTS gsc_search_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_norm TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_path TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  search_type TEXT NOT NULL DEFAULT 'web',
  search_appearance TEXT NOT NULL DEFAULT '',
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL,
  position REAL,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'non_product',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, query_norm, page_url, country, device, search_type, search_appearance)
);

CREATE INDEX IF NOT EXISTS idx_gsc_search_daily_date ON gsc_search_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_gsc_search_daily_product_date ON gsc_search_daily(product_id, report_date);
CREATE INDEX IF NOT EXISTS idx_gsc_search_daily_page_date ON gsc_search_daily(page_path, report_date);
CREATE INDEX IF NOT EXISTS idx_gsc_search_daily_query_date ON gsc_search_daily(query_norm, report_date);

-- Daily aggregate across all mapped + non-mapped landing pages
CREATE VIEW IF NOT EXISTS analysis_gsc_daily AS
SELECT
  g.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT g.query_norm) AS queries,
  COUNT(DISTINCT g.page_path) AS pages,
  SUM(g.clicks) AS clicks,
  SUM(g.impressions) AS impressions,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
  END AS avg_position,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.clicks ELSE 0 END) AS mapped_clicks,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.impressions ELSE 0 END) AS mapped_impressions
FROM gsc_search_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
GROUP BY g.report_date;

-- Landing-page daily aggregate (identity kept at normalized page_path)
CREATE VIEW IF NOT EXISTS analysis_gsc_page_daily AS
SELECT
  g.report_date,
  g.page_path,
  g.product_id,
  COUNT(DISTINCT g.query_norm) AS queries,
  SUM(g.clicks) AS clicks,
  SUM(g.impressions) AS impressions,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
  END AS avg_position
FROM gsc_search_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
GROUP BY g.report_date, g.page_path, g.product_id;

-- Product-level daily aggregate (only defensibly mapped product pages)
CREATE VIEW IF NOT EXISTS analysis_gsc_product_daily AS
SELECT
  g.report_date,
  g.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COUNT(DISTINCT g.query_norm) AS queries,
  COUNT(DISTINCT g.page_path) AS landing_pages,
  SUM(g.clicks) AS clicks,
  SUM(g.impressions) AS impressions,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(g.impressions) > 0
       THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
  END AS avg_position
FROM gsc_search_daily g
JOIN products p ON p.id = g.product_id
WHERE g.product_id IS NOT NULL
  AND g.report_date IS NOT NULL AND length(g.report_date) = 10
GROUP BY g.report_date, g.product_id, p.slug, p.title_en;

-- Product 28-day vs previous-28-day trend
CREATE VIEW IF NOT EXISTS analysis_gsc_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.clicks, 0) AS clicks_28d,
  COALESCE(cur.impressions, 0) AS impressions_28d,
  cur.ctr_pct AS ctr_28d,
  cur.avg_position AS avg_position_28d,
  COALESCE(prev.clicks, 0) AS clicks_prev_28d,
  COALESCE(prev.impressions, 0) AS impressions_prev_28d,
  prev.ctr_pct AS ctr_prev_28d,
  prev.avg_position AS avg_position_prev_28d,
  CASE WHEN COALESCE(prev.clicks, 0) > 0
       THEN ROUND((COALESCE(cur.clicks, 0) - prev.clicks) * 100.0 / prev.clicks, 2)
  END AS clicks_growth_pct,
  CASE WHEN COALESCE(prev.impressions, 0) > 0
       THEN ROUND((COALESCE(cur.impressions, 0) - prev.impressions) * 100.0 / prev.impressions, 2)
  END AS impressions_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM gsc_search_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    CASE WHEN SUM(impressions) > 0
         THEN ROUND(SUM(clicks) * 100.0 / SUM(impressions), 2)
    END AS ctr_pct,
    CASE WHEN SUM(impressions) > 0
         THEN ROUND(SUM(COALESCE(position, 0) * impressions) * 1.0 / SUM(impressions), 2)
    END AS avg_position
  FROM gsc_search_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    CASE WHEN SUM(impressions) > 0
         THEN ROUND(SUM(clicks) * 100.0 / SUM(impressions), 2)
    END AS ctr_pct,
    CASE WHEN SUM(impressions) > 0
         THEN ROUND(SUM(COALESCE(position, 0) * impressions) * 1.0 / SUM(impressions), 2)
    END AS avg_position
  FROM gsc_search_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;

-- Freshness + sync health snapshot for the GSC collector
CREATE VIEW IF NOT EXISTS analysis_gsc_freshness AS
SELECT
  (SELECT MAX(report_date) FROM gsc_search_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM gsc_search_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM gsc_search_daily) AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source = 'gsc-make-collector' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source = 'gsc-make-collector'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source = 'gsc-make-collector') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source = 'gsc-make-collector'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
