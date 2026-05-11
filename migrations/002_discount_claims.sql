-- MildMate Migration 002
-- Adds discount_claims table for first-order 15%-off tracking
-- One active discount per normalized shipping address at a time

CREATE TABLE IF NOT EXISTS discount_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,          -- e.g. WEL15-X7K9M2
  status TEXT DEFAULT 'issued',       -- issued | used | expired
  address_hash TEXT,                  -- SHA-256 of normalized shipping address (NULL until claimed)
  order_id INTEGER,                   -- Links to orders.id once used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at DATETIME,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Prevent duplicate active codes per physical address
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_active_address
ON discount_claims(address_hash, status)
WHERE status = 'issued' AND address_hash IS NOT NULL;

-- Quick lookup by email
CREATE INDEX IF NOT EXISTS idx_discount_email ON discount_claims(email);

-- Quick lookup by code
CREATE INDEX IF NOT EXISTS idx_discount_code ON discount_claims(code);
