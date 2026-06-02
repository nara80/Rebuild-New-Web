-- Migration 009: Customer saved addresses
-- Used by: /account/ → Addresses tab, /checkout/ → auto-fill shipping

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',       -- Home, Office, Other
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_addresses_email ON customer_addresses(email);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON customer_addresses(email, is_default);
