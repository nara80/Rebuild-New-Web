-- 047_gsc_freshness_sources.sql
-- Phase 09.1 addendum: allow analysis_gsc_freshness to read sync health
-- from any GSC collector source (Make.com or Cloudflare Worker cron).

DROP VIEW IF EXISTS analysis_gsc_freshness;

CREATE VIEW IF NOT EXISTS analysis_gsc_freshness AS
SELECT
  (SELECT MAX(report_date) FROM gsc_search_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM gsc_search_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM gsc_search_daily) AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'gsc-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'gsc-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'gsc-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'gsc-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
