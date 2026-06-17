-- Migration 003: Custom Quotes table for custom-size orders
-- Run: npx wrangler d1 execute mildmate-db --file=./migrations/003_custom_quotes.sql

CREATE TABLE IF NOT EXISTS custom_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  telephone TEXT,
  product_slug TEXT NOT NULL,
  dimensions TEXT NOT NULL,
  fabric TEXT,
  color TEXT,
  status TEXT DEFAULT 'pending',
  quoted_price INTEGER,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_email ON custom_quotes(email);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON custom_quotes(status);
