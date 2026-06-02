-- Centralized country shipping rates (Option A)
CREATE TABLE IF NOT EXISTS shipping_rates (
  country_code TEXT PRIMARY KEY,              -- ISO2, e.g. TH, US, DE, or OTHER
  country_name TEXT NOT NULL,
  first_item_usd REAL NOT NULL DEFAULT 0,
  additional_item_usd REAL NOT NULL DEFAULT 0,
  first_item_thb REAL NOT NULL DEFAULT 0,
  additional_item_thb REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT (datetime('now'))
);

INSERT INTO shipping_rates (country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at)
SELECT 'TH', 'Thailand', 4, 1.5, 120, 50, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'TH');

INSERT INTO shipping_rates (country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at)
SELECT 'US', 'United States', 16, 6, 560, 210, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'US');

INSERT INTO shipping_rates (country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at)
SELECT 'OTHER', 'Other Countries', 25, 10, 850, 300, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'OTHER');
