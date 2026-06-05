-- MildMate Migration 021
-- Adds promo_codes table for admin-created custom promo codes
-- Mutual exclusivity with discount_claims and other discounts at checkout

CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- admin-defined, alphanumeric only
  discount_pct INTEGER NOT NULL,       -- e.g. 10, 15, 20
  order_minimum_thb INTEGER DEFAULT 0, -- cart must reach this THB amount
  duration_days INTEGER NOT NULL,      -- 1, 3, 7 days from creation
  max_uses INTEGER DEFAULT 1,          -- total redemption limit (null = unlimited)
  use_count INTEGER DEFAULT 0,         -- tracks how many times used
  per_email_limit INTEGER DEFAULT 1,   -- 1 = one per email, 0 = no per-email limit
  is_active INTEGER DEFAULT 1,          -- 1=active, 0=revoked
  created_by TEXT,                      -- admin email who created it
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME                  -- computed as created_at + duration_days
);

-- Fast lookup by code
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

-- Track usage per email per code (for per_email_limit enforcement)
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  order_id INTEGER,
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_email ON promo_redemptions(promo_id, email);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_order ON promo_redemptions(order_id);
