-- 045_marketing_sync_state.sql
-- Phase 17 (Marketing Decision System): persisted state for the scheduled
-- confirmed-mapping sync Worker.
--
-- Two concerns, two tables:
--   marketing_sync_state — pagination cursor + last-run bookkeeping, so a
--     bounded/interrupted invocation resumes exactly where it stopped instead
--     of restarting the scan. Replaces the CLI's on-disk state file, which a
--     Worker has no access to.
--   marketing_sync_lock — mutual exclusion so two overlapping invocations can
--     never process the same records. `locked_until` is an expiry, not a flag,
--     so a crashed run cannot deadlock the schedule forever.
--
-- Additive only; no existing tables are modified.

CREATE TABLE IF NOT EXISTS marketing_sync_state (
  name TEXT PRIMARY KEY,                    -- logical stream, e.g. 'notion-mapping-sync'
  cursor TEXT,                              -- Notion pagination cursor (NULL = start from beginning)
  last_run_at TEXT,
  last_success_at TEXT,
  last_status TEXT,                         -- success | partial | failed | skipped_locked
  last_processed INTEGER DEFAULT 0,
  last_synced INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_sync_lock (
  name TEXT PRIMARY KEY,                    -- same logical stream name
  locked_until TEXT,                        -- ISO timestamp; past/NULL means free
  run_id TEXT,                              -- holder identity, for diagnostics
  updated_at TEXT
);

-- Seed both rows so the Worker's acquire step is a pure UPDATE (atomic in D1)
-- and never has to branch on "row missing".
INSERT OR IGNORE INTO marketing_sync_state (name, cursor, last_status)
VALUES ('notion-mapping-sync', NULL, NULL);

INSERT OR IGNORE INTO marketing_sync_lock (name, locked_until, run_id)
VALUES ('notion-mapping-sync', NULL, NULL);
