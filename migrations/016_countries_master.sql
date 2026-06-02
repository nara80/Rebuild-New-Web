-- Centralized country master list for checkout/account/admin dropdown consistency
CREATE TABLE IF NOT EXISTS countries_master (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  phone_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_fallback INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now'))
);
