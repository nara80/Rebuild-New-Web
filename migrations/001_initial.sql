-- MildMate Database Schema — Initial Migration
-- Creates 4 tables: products, orders, abandoned_carts, subscribers
-- Run with: npx wrangler d1 execute mildmate-db --file=migrations/001_initial.sql

-- ===========================================
-- Table: products
-- Product catalog with bilingual titles and pricing
-- ===========================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_th TEXT,
  description_en TEXT,
  description_th TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  fabric_options TEXT DEFAULT 'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  base_price_usd REAL NOT NULL DEFAULT 0,
  base_price_thb REAL NOT NULL DEFAULT 0,
  price_per_cm2_usd REAL DEFAULT 0,
  price_per_cm2_thb REAL DEFAULT 0,
  is_custom INTEGER DEFAULT 1,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Table: orders
-- Customer orders with full custom dimension details
-- ===========================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  shipping_address TEXT,
  product_slug TEXT NOT NULL,
  product_title_en TEXT,
  fabric TEXT,
  color TEXT,
  width_cm REAL,
  length_cm REAL,
  depth_cm REAL,
  width_in REAL,
  length_in REAL,
  depth_in REAL,
  custom_notes TEXT,
  price_usd REAL,
  price_thb REAL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Table: abandoned_carts
-- Captured at checkout Step 2 (email entry) for recovery emails
-- ===========================================
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  customer_name TEXT,
  cart_json TEXT NOT NULL,
  recovered INTEGER DEFAULT 0,
  recovery_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Table: subscribers
-- Email signup list from footer + homepage
-- ===========================================
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',
  language TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Indexes for performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_email ON abandoned_carts(email);
CREATE INDEX IF NOT EXISTS idx_abandoned_recovered ON abandoned_carts(recovered, created_at);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
