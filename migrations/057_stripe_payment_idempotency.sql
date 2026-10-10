-- Migration 057: Stripe payment verification and idempotent fulfillment guards

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_session_id TEXT,
  processing_token TEXT,
  processed_at DATETIME,
  process_result TEXT,
  last_error TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_session
  ON stripe_webhook_events(stripe_session_id);

CREATE TABLE IF NOT EXISTS stripe_order_fulfillment_lines (
  line_key TEXT PRIMARY KEY,
  stripe_session_id TEXT NOT NULL,
  stripe_event_id TEXT,
  line_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_fulfillment_session
  ON stripe_order_fulfillment_lines(stripe_session_id);
