-- Shipping global addition rates (per tier, not per country)
-- Phase 8 — only the "first" (initial) cost varies by country; "add" cost is global per tier

CREATE TABLE IF NOT EXISTS shipping_add_rates (
  tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
  add_thb INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Default global add rates (USD converted to THB at rate ~30)
-- Tier 1: $20 = 600 THB, Tier 2: $15 = 450 THB, Tier 3: $5 = 150 THB
INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (1, 600);
INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (2, 450);
INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (3, 150);
