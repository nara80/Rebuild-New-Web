-- Phase 3: Customer acquisition attribution persistence
-- Stores first-touch, quote-session, and checkout-session attribution by quote_id.

CREATE TABLE IF NOT EXISTS quote_acquisition_attribution (
  quote_id TEXT PRIMARY KEY,
  email TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  first_touch_json TEXT,
  quote_session_json TEXT,
  checkout_session_json TEXT,
  consent_state_json TEXT,
  quote_session_captured_at DATETIME,
  checkout_session_captured_at DATETIME,
  checkout_stripe_session_id TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quote_acquisition_attr_email
  ON quote_acquisition_attribution(email);
CREATE INDEX IF NOT EXISTS idx_quote_acquisition_attr_checkout_session
  ON quote_acquisition_attribution(checkout_stripe_session_id);
