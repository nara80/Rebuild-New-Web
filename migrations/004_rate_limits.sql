-- MildMate D1 Migration 004 — Rate limiting table
-- Run with: npx wrangler d1 execute mildmate-db --file=migrations/004_rate_limits.sql

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,       -- 'quote' | 'subscribe' | 'contact'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created ON rate_limits(created_at);
