-- MildMate Migration 062
-- Phase 12 canonical GA4 alignment (read-model correction)
-- Scope: redefine website GA4 freshness to canonical property 308922589 only.
-- Safety: legacy website property rows (366290587) remain preserved in
-- ga4_funnel_daily and are not deleted or rewritten.

DROP VIEW IF EXISTS analysis_ga4_freshness;

CREATE VIEW analysis_ga4_freshness AS
SELECT
  (SELECT MAX(report_date)
     FROM ga4_funnel_daily
    WHERE property_scope = 'website'
      AND property_id = '308922589') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
     FROM ga4_funnel_daily
    WHERE property_scope = 'website'
      AND property_id = '308922589') AS days_since_latest_report,
  (SELECT COUNT(*)
     FROM ga4_funnel_daily
    WHERE property_scope = 'website'
      AND property_id = '308922589') AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at))
     FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status = 'success') AS last_success_sync_at,
  (SELECT status
     FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron'
    ORDER BY COALESCE(finished_at, created_at) DESC
    LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at))
     FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron') AS last_sync_at,
  (SELECT COUNT(*)
     FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
