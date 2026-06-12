-- Safe migration: add global addition rates table + seed default shipping rates
-- All IF NOT EXISTS / INSERT OR IGNORE so it's idempotent

CREATE TABLE IF NOT EXISTS shipping_add_rates (
  tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
  add_thb INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (1, 600);
INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (2, 450);
INSERT OR IGNORE INTO shipping_add_rates (tier, add_thb) VALUES (3, 150);

-- Seed default tier rates for existing countries (only if tier columns are 0)
UPDATE shipping_rates SET tier1_first_thb = 2500 WHERE country_code = 'US' AND tier1_first_thb = 0;
UPDATE shipping_rates SET tier2_first_thb = 2000 WHERE country_code = 'US' AND tier2_first_thb = 0;
UPDATE shipping_rates SET tier3_first_thb = 750 WHERE country_code = 'US' AND tier3_first_thb = 0;

UPDATE shipping_rates SET tier1_first_thb = 2800 WHERE country_code = 'DE' AND tier1_first_thb = 0;
UPDATE shipping_rates SET tier2_first_thb = 2200 WHERE country_code = 'DE' AND tier2_first_thb = 0;
UPDATE shipping_rates SET tier3_first_thb = 800 WHERE country_code = 'DE' AND tier3_first_thb = 0;

UPDATE shipping_rates SET tier1_first_thb = 3200 WHERE country_code = 'AU' AND tier1_first_thb = 0;
UPDATE shipping_rates SET tier2_first_thb = 2600 WHERE country_code = 'AU' AND tier2_first_thb = 0;
UPDATE shipping_rates SET tier3_first_thb = 900 WHERE country_code = 'AU' AND tier3_first_thb = 0;

UPDATE shipping_rates SET tier1_first_thb = 2200 WHERE country_code = 'OTHER' AND tier1_first_thb = 0;
UPDATE shipping_rates SET tier2_first_thb = 1800 WHERE country_code = 'OTHER' AND tier2_first_thb = 0;
UPDATE shipping_rates SET tier3_first_thb = 650 WHERE country_code = 'OTHER' AND tier3_first_thb = 0;
