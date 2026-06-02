-- Migration 020: thankyou_queue table
-- Stores pending thank-you discount emails to send after order confirmation
-- Cron worker picks up entries where send_after <= now AND sent = 0

CREATE TABLE IF NOT EXISTS thankyou_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  email TEXT NOT NULL,
  discount_code TEXT NOT NULL,
  discount_pct INTEGER NOT NULL,
  send_after TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_thankyou_queue_pending ON thankyou_queue(sent, send_after);

-- Add thankyou settings to recovery_config
INSERT OR REPLACE INTO recovery_config (key, value) VALUES ('thankyou_discount', '20');
INSERT OR REPLACE INTO recovery_config (key, value) VALUES ('thankyou_send_after_hours', '1');
