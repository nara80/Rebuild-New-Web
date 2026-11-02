-- MildMate Migration 061
-- GA4 Lead Acquisition (additive-only)
-- Purpose:
--   Store GA4 lead events (generate_lead, quote_request) at daily
--   session-acquisition grain for the SEO & Website dashboard section.
-- Notes:
--   - Additive only (no destructive edits).
--   - Canonical website property for this layer is 308922589.
--   - This migration is prepared only; do not execute as part of local-only work.

CREATE TABLE IF NOT EXISTS ga4_lead_acquisition_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  session_source TEXT NOT NULL DEFAULT '',
  session_medium TEXT NOT NULL DEFAULT '',
  session_campaign TEXT NOT NULL DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 0,
  event_users INTEGER,
  users_available INTEGER NOT NULL DEFAULT 1,
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_date, property_id, event_name, session_source, session_medium, session_campaign)
);

CREATE INDEX IF NOT EXISTS idx_ga4_lead_daily_date
  ON ga4_lead_acquisition_daily(report_date);

CREATE INDEX IF NOT EXISTS idx_ga4_lead_daily_property_date
  ON ga4_lead_acquisition_daily(property_id, report_date);

CREATE INDEX IF NOT EXISTS idx_ga4_lead_daily_event_date
  ON ga4_lead_acquisition_daily(event_name, report_date);

CREATE INDEX IF NOT EXISTS idx_ga4_lead_daily_source_date
  ON ga4_lead_acquisition_daily(session_source, session_medium, report_date);

DROP VIEW IF EXISTS analysis_ga4_lead_freshness;

CREATE VIEW analysis_ga4_lead_freshness AS
SELECT
  (SELECT MAX(report_date) FROM ga4_lead_acquisition_daily WHERE property_id = '308922589') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_lead_acquisition_daily WHERE property_id = '308922589') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_lead_acquisition_daily WHERE property_id = '308922589') AS total_rows,
  (SELECT COALESCE(SUM(event_count), 0) FROM ga4_lead_acquisition_daily WHERE property_id = '308922589') AS total_event_count,
  (SELECT MAX(COALESCE(finished_at, created_at))
     FROM sync_runs
    WHERE source = 'ga4-lead-worker-cron:website' AND status = 'success') AS last_success_sync_at,
  (SELECT status
     FROM sync_runs
    WHERE source = 'ga4-lead-worker-cron:website'
    ORDER BY COALESCE(finished_at, created_at) DESC
    LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at))
     FROM sync_runs
    WHERE source = 'ga4-lead-worker-cron:website') AS last_sync_at,
  (SELECT COUNT(*)
     FROM sync_runs
    WHERE source = 'ga4-lead-worker-cron:website'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
