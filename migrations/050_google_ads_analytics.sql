-- MildMate Migration 050
-- Marketing Decision System — Phase 12 (Google Ads paid media analytics)
-- Adds Google Ads daily campaign fact storage + analytical views. Additive only.

CREATE TABLE IF NOT EXISTS google_ads_campaign_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  ad_group_id TEXT NOT NULL DEFAULT '',
  ad_group_name TEXT NOT NULL DEFAULT '',
  channel_type TEXT NOT NULL DEFAULT '',
  network TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversion_value REAL NOT NULL DEFAULT 0,
  all_conversions REAL,
  all_conversions_value REAL,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, customer_id, campaign_id, ad_group_id, network, device, currency)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_daily_date
  ON google_ads_campaign_daily(report_date);
CREATE INDEX IF NOT EXISTS idx_google_ads_daily_campaign_date
  ON google_ads_campaign_daily(campaign_id, ad_group_id, report_date);
CREATE INDEX IF NOT EXISTS idx_google_ads_daily_product_date
  ON google_ads_campaign_daily(product_id, report_date);

CREATE VIEW IF NOT EXISTS analysis_google_ads_daily AS
SELECT
  a.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT a.campaign_id) AS campaigns,
  COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_groups,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  SUM(COALESCE(a.all_conversions, 0)) AS all_conversions,
  SUM(COALESCE(a.all_conversions_value, 0)) AS all_conversions_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas,
  SUM(CASE WHEN a.product_id IS NOT NULL THEN a.cost ELSE 0 END) AS mapped_cost,
  SUM(CASE WHEN a.product_id IS NOT NULL THEN a.conversions ELSE 0 END) AS mapped_conversions
FROM google_ads_campaign_daily a
WHERE a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY a.report_date;

CREATE VIEW IF NOT EXISTS analysis_google_ads_campaign_daily AS
SELECT
  a.report_date,
  a.customer_id,
  a.customer_name,
  a.campaign_id,
  a.campaign_name,
  a.ad_group_id,
  a.ad_group_name,
  a.channel_type,
  a.network,
  a.device,
  a.currency,
  a.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  SUM(COALESCE(a.all_conversions, 0)) AS all_conversions,
  SUM(COALESCE(a.all_conversions_value, 0)) AS all_conversions_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas
FROM google_ads_campaign_daily a
LEFT JOIN products p ON p.id = a.product_id
WHERE a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY
  a.report_date, a.customer_id, a.customer_name, a.campaign_id, a.campaign_name,
  a.ad_group_id, a.ad_group_name, a.channel_type, a.network, a.device, a.currency,
  a.product_id, p.slug, p.title_en;

CREATE VIEW IF NOT EXISTS analysis_google_ads_product_daily AS
SELECT
  a.report_date,
  a.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COUNT(DISTINCT a.campaign_id) AS campaign_count,
  COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_group_count,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas
FROM google_ads_campaign_daily a
JOIN products p ON p.id = a.product_id
WHERE a.product_id IS NOT NULL
  AND a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY a.report_date, a.product_id, p.slug, p.title_en;

CREATE VIEW IF NOT EXISTS analysis_google_ads_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.cost, 0) AS cost_28d,
  COALESCE(cur.clicks, 0) AS clicks_28d,
  COALESCE(cur.impressions, 0) AS impressions_28d,
  COALESCE(cur.conversions, 0) AS conversions_28d,
  COALESCE(cur.conversion_value, 0) AS conversion_value_28d,
  COALESCE(prev.cost, 0) AS cost_prev_28d,
  COALESCE(prev.clicks, 0) AS clicks_prev_28d,
  COALESCE(prev.impressions, 0) AS impressions_prev_28d,
  COALESCE(prev.conversions, 0) AS conversions_prev_28d,
  COALESCE(prev.conversion_value, 0) AS conversion_value_prev_28d,
  CASE WHEN COALESCE(cur.conversions, 0) > 0
       THEN ROUND(cur.cost / cur.conversions, 2)
  END AS cpa_28d,
  CASE WHEN COALESCE(cur.cost, 0) > 0
       THEN ROUND(cur.conversion_value / cur.cost, 2)
  END AS roas_28d,
  CASE WHEN COALESCE(prev.conversions, 0) > 0
       THEN ROUND(prev.cost / prev.conversions, 2)
  END AS cpa_prev_28d,
  CASE WHEN COALESCE(prev.cost, 0) > 0
       THEN ROUND(prev.conversion_value / prev.cost, 2)
  END AS roas_prev_28d,
  CASE WHEN COALESCE(prev.cost, 0) > 0
       THEN ROUND((COALESCE(cur.cost, 0) - prev.cost) * 100.0 / prev.cost, 2)
  END AS cost_growth_pct,
  CASE WHEN COALESCE(prev.conversions, 0) > 0
       THEN ROUND((COALESCE(cur.conversions, 0) - prev.conversions) * 100.0 / prev.conversions, 2)
  END AS conversions_growth_pct,
  CASE WHEN COALESCE(prev.conversion_value, 0) > 0
       THEN ROUND((COALESCE(cur.conversion_value, 0) - prev.conversion_value) * 100.0 / prev.conversion_value, 2)
  END AS conversion_value_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SUM(conversions) AS conversions,
    SUM(conversion_value) AS conversion_value
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SUM(conversions) AS conversions,
    SUM(conversion_value) AS conversion_value
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;

CREATE VIEW IF NOT EXISTS analysis_google_ads_freshness AS
SELECT
  (SELECT MAX(report_date) FROM google_ads_campaign_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM google_ads_campaign_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM google_ads_campaign_daily) AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'google-ads-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'google-ads-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'google-ads-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'google-ads-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
