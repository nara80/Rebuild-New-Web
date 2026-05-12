-- Migration 003: Custom Quotes table for custom-size orders
-- Run: npx wrangler d1 execute mildmate-db --file=./migrations/003_custom_quotes.sql

CREATE TABLE IF NOT EXISTS custom_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  product_type TEXT,
  dimensions TEXT,
  fabric TEXT,
  color TEXT,
  extras TEXT,
  status TEXT DEFAULT 'pending',
  quoted_price INTEGER,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON custom_quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_email ON custom_quotes(customer_email);
CREATE INDEX IF NOT EXISTS idx_quotes_id ON custom_quotes(quote_id);
