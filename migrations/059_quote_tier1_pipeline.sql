-- Tier 1 quote pipeline foundation
-- Adds exact quote->order attribution and one-stage quote follow-up audit trail.

ALTER TABLE orders ADD COLUMN quote_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id);

CREATE TABLE IF NOT EXISTS quote_followup_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL,
  email TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- sent | failed | skipped
  error TEXT,
  sent_at DATETIME,
  run_source TEXT DEFAULT 'cron-worker',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_followup_unique_stage
  ON quote_followup_events(quote_id, stage);
CREATE INDEX IF NOT EXISTS idx_quote_followup_status_sent
  ON quote_followup_events(status, sent_at);
CREATE INDEX IF NOT EXISTS idx_quote_followup_email_created
  ON quote_followup_events(email, created_at);

INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('quote_followup_enabled', 'false');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('quote_followup_age_hours', '72');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('quote_followup_expiry_window_days', '7');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('quote_followup_daily_cap', '20');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('quote_followup_email_cooldown_hours', '24');
