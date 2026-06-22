-- D1 Database Schema for MildMate Etsy Manager

-- 1. Table to store listing information
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  etsy_listing_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  tags TEXT, -- Comma-separated list of tags
  variations TEXT, -- JSON string representation of sizes, fabrics, SKUs, and prices
  images TEXT, -- JSON string representation of R2 image URLs
  last_synced TEXT
);

-- 2. Table to store OAuth 2.0 Credentials (enforces a single row)
CREATE TABLE IF NOT EXISTS etsy_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Epoch timestamp in seconds
  refresh_lock_acquired_at INTEGER DEFAULT 0 -- Epoch timestamp in seconds (0 = unlocked)
);
