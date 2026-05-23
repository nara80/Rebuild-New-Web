-- MildMate D1 Migration 005 — Dynamic pricing parameters + DIY prices + exchange rates
-- Run with: npx wrangler d1 execute mildmate-db --file=migrations/005_pricing_params.sql

-- All adjustable formula constants (Super Admin only)
CREATE TABLE IF NOT EXISTS pricing_params (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL,
  label TEXT,
  category TEXT NOT NULL,       -- 'fabric' | 'margin' | 'sewing' | 'fixed' | 'marketing' | 'operations'
  updated_at TEXT DEFAULT (datetime('now'))
);

-- DIY pricing table — spreadsheet import/export (product × size × shape)
CREATE TABLE IF NOT EXISTS diy_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_slug TEXT NOT NULL,
  shape_code TEXT,              -- NULL for rectangular products, 'A'-'I' for marine shapes
  size_key TEXT,                -- '153x203x30' format, NULL for shapes without size
  price_thb INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  label TEXT,                   -- Human-readable label, e.g. "Marine Shape A — V-Berth Narrow Foot"
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diy_product ON diy_prices(product_slug, shape_code);

-- Exchange rates per currency (Super Admin only)
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency TEXT PRIMARY KEY,     -- 'USD', 'EUR', 'GBP', 'JPY', 'MYR', 'CAD', 'AUD', 'SGD'
  rate_per_thb REAL NOT NULL,   -- e.g. 0.033 for USD (1 THB = 0.033 USD)
  label TEXT,                   -- "US Dollar"
  symbol TEXT,                  -- "$", "€", "£", "¥", "RM", "C$", "A$", "S$"
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Seed data: current pricing parameters ──

-- Fabric rates (THB per yard, 91.44cm × 260cm bolt = 23,744 cm²)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('fabric_rate_cloudsoft', 100, 'CloudSoft Rate (THB/yd)', 'fabric'),
  ('fabric_rate_breezeplus', 180, 'BreezePlus Rate (THB/yd)', 'fabric'),
  ('fabric_rate_premacotton', 180, 'PremaCotton Rate (THB/yd)', 'fabric'),
  ('fabric_rate_ecoluxe', 180, 'EcoLuxe Rate (THB/yd)', 'fabric'),
  ('fabric_rate_tpu', 120, 'TPU Rate (THB/linear metre)', 'fabric');

-- Fabric waste factor
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('waste_factor_fabric', 20, 'Fabric Waste (%)', 'waste'),
  ('waste_factor_pillowcase', 60, 'Pillow Waste (%)', 'waste'),

-- Bolt dimensions
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('tpu_bolt_width_cm', 210, 'TPU Bolt Width (cm)', 'fabric'),
  ('tpu_sqcm_per_lm', 21000, 'TPU cm² per Linear Metre', 'fabric');

-- Margin rates (stored as integer %, e.g. 30 = 30%)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('margin_rate_standard', 30, 'Standard Margin Rate', 'margin'),
  ('margin_rate_rv_truck', 45, 'RV & Truck Margin Rate', 'margin'),
  ('margin_rate_family', 50, 'Family Margin Rate', 'margin'),
  ('margin_rate_marine', 680, 'Marine V-Berth Margin Rate', 'margin'),
  ('margin_rate_encasement', 50, 'Encasement Margin Rate', 'margin'),
  ('encasement_mkt_rate', 25, 'Encasement Marketing Rate', 'margin'),
  ('margin_rate_duvet', 30, 'Duvet Cover Margin Rate', 'margin'),
  ('margin_rate_pillow', 15, 'Pillowcase Margin Rate', 'margin'),
  ('margin_rate_pillow_protector', 35, 'Pillow Protector Margin Rate', 'margin'),
  ('margin_rate_protector_standard', 15, 'Protector Standard Margin', 'margin'),
  ('margin_rate_protector_deep', 25, 'Protector Deep Pocket Margin', 'margin'),
  ('margin_rate_protector_family', 50, 'Protector Family Margin', 'margin');

-- Operations & Marketing rates (shared across most products)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('ops_rate', 15, 'Operations Rate', 'operations'),
  ('mkt_rate', 20, 'Marketing Rate', 'marketing');

-- Fitted sheet sewing cost tiers (THB, by fabric area thresholds in cm²)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('sewing_tier1_max', 51600, 'Fitted 3.5F Max Area (cm²)', 'sewing'),
  ('sewing_tier1_cost', 120, 'Fitted 3.5F Cost (THB)', 'sewing'),
  ('sewing_tier2_max', 71000, 'Fitted 5,6F Max Area (cm²)', 'sewing'),
  ('sewing_tier2_cost', 200, 'Fitted 5,6F Cost (THB)', 'sewing'),
  ('sewing_tier3_max', 91200, 'Fitted 8F, 6F+Extend Max Area (cm²)', 'sewing'),
  ('sewing_tier3_cost', 300, 'Fitted 8F, 6F+Extend Cost (THB)', 'sewing'),
  ('sewing_tier4_max', 120000, 'Fitted 10F, 8F+Extend Max Area (cm²)', 'sewing'),
  ('sewing_tier4_cost', 400, 'Fitted 10F, 8F+Extend Cost (THB)', 'sewing'),
  ('sewing_tier5_cost', 500, 'Fitted 10F+Extend Cost (THB, >120,000)', 'sewing');

-- Duvet cover sewing tiers (5 products: 3-sided, pet-owner, marine, RV, dorm)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('duvet_sewing_tier1_max', 98000, 'Duvet Tier 1 Max Area (cm²)', 'sewing'),
  ('duvet_sewing_tier1_cost', 300, 'Duvet Tier 1 Cost (THB, ≤98,000)', 'sewing'),
  ('duvet_sewing_tier2_max', 139000, 'Duvet Tier 2 Max Area (cm²)', 'sewing'),
  ('duvet_sewing_tier2_cost', 400, 'Duvet Tier 2 Cost (THB, ≤139,000)', 'sewing'),
  ('duvet_sewing_tier3_max', 170000, 'Duvet Tier 3 Max Area (cm²)', 'sewing'),
  ('duvet_sewing_tier3_cost', 500, 'Duvet Tier 3 Cost (THB, ≤170,000)', 'sewing'),
  ('duvet_sewing_tier4_cost', 600, 'Duvet Tier 4 Cost (THB, >170,000)', 'sewing');

-- Flat sewing & pillow sewing
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('flat_sewing_cost', 250, 'Flat Sheet Sewing Cost (THB)', 'sewing'),
  ('pillow_sewing_cost', 40, 'Pillowcase Sewing Cost (THB)', 'sewing'),
  ('pillow_sham_sewing_cost', 50, 'Sham Pillowcase Sewing Cost (THB)', 'sewing'),
  ('encasement_sewing_cost', 300, 'Encasement Sewing Cost (THB)', 'sewing');

-- Fixed costs
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('packing_cost', 100, 'Packing Cost (THB)', 'fixed'),
  ('delivery_cost', 50, 'Delivery Cost (THB)', 'fixed'),
  ('protector_packing', 200, 'Protector Packing Cost (THB)', 'fixed'),
  ('protector_delivery', 80, 'Protector Delivery Cost (THB)', 'fixed');

-- Zipper rate
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('zipper_rate', 0.4, 'Zipper Rate (THB/cm)', 'fixed');

-- Accessories rate (fraction of fabric cost)
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('accessories_rate', 10, 'Accessories Rate (%)', 'fixed');

-- Flat sheet tuck allowance
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('flat_tuck_cm', 25, 'Flat Sheet Tuck Allowance per side (cm)', 'fixed');

-- Max dimensions
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('max_width_cm', 220, 'Max Fitted Sheet Width (cm)', 'fixed'),
  ('max_pillow_cm', 120, 'Max Pillowcase Dimension (cm)', 'fixed'),
  ('max_protector_cm', 210, 'Max Protector Dimension (cm, non-family)', 'fixed');

-- Sewing allowance
INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('sewing_allowance_cm', 14, 'Sewing Allowance (cm)', 'fixed');

-- ── Seed data: exchange rates ──
INSERT OR IGNORE INTO exchange_rates (currency, rate_per_thb, label, symbol) VALUES
  ('USD', 0.033, 'US Dollar', '$'),
  ('EUR', 0.031, 'Euro', '€'),
  ('GBP', 0.026, 'British Pound', '£'),
  ('JPY', 4.95, 'Japanese Yen', '¥'),
  ('MYR', 0.15, 'Malaysian Ringgit', 'RM'),
  ('CAD', 0.045, 'Canadian Dollar', 'C$'),
  ('AUD', 0.052, 'Australian Dollar', 'A$'),
  ('SGD', 0.044, 'Singapore Dollar', 'S$');

-- ── Seed data: DIY prices (current marine shape prices) ──
INSERT OR IGNORE INTO diy_prices (product_slug, shape_code, price_thb, price_usd, label) VALUES
  ('marine-fitted-sheet', 'A', 2820, 94, 'Shape A — V-Berth Narrow Foot'),
  ('marine-fitted-sheet', 'B', 3330, 111, 'Shape B — V-Berth Wide Foot'),
  ('marine-fitted-sheet', 'C', 3750, 125, 'Shape C — V-Berth King Size'),
  ('marine-fitted-sheet', 'D', 3750, 125, 'Shape D — Double Round End'),
  ('marine-fitted-sheet', 'E', 4140, 138, 'Shape E — King Size Round End'),
  ('marine-fitted-sheet', 'F', 3300, 110, 'Shape F — Single Quarter Berth'),
  ('marine-fitted-sheet', 'G', 3240, 108, 'Shape G — Cut Off Corner'),
  ('marine-fitted-sheet', 'H', 3960, 132, 'Shape H — Octagonal Berth');
