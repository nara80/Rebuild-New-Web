-- MildMate Migration 057
-- Align analysis_ga4_freshness_etsy.mapped_sessions with canonical Etsy mapping
-- source: etsy_listing_master.product_id via listing_id.
-- Scope: view-only change; no table/data writes.

DROP VIEW IF EXISTS analysis_ga4_freshness_etsy;

CREATE VIEW analysis_ga4_freshness_etsy AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS total_rows,
  (SELECT COUNT(DISTINCT listing_id) FROM ga4_funnel_daily
    WHERE property_scope = 'etsy' AND listing_id IS NOT NULL) AS distinct_listings,
  (SELECT SUM(
      CASE WHEN EXISTS (
        SELECT 1
        FROM etsy_listing_master m
        WHERE m.listing_id = g.listing_id
          AND m.product_id IS NOT NULL
      )
      THEN g.sessions ELSE 0 END
    )
   FROM ga4_funnel_daily g
   WHERE g.property_scope = 'etsy') AS mapped_sessions,
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
