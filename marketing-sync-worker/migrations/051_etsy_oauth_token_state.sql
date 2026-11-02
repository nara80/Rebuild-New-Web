-- MildMate Marketing Sync Worker
-- Etsy OAuth rotating refresh-token state.
-- Refresh-token contents are stored encrypted; never store plaintext tokens here.

CREATE TABLE IF NOT EXISTS oauth_token_state (
  provider TEXT PRIMARY KEY,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
