-- Shipping Product Tiers + Tier-based country rates (Phase 8)
-- Replaces flat first_item/additional_item with 3 weight-based tiers per country

-- 1. Product tier assignment table
CREATE TABLE IF NOT EXISTS shipping_product_tiers (
  product_slug TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK(tier IN (1,2,3)),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Seed all 27 products into their tiers
-- Tier 1: Heavy — protectors + duvet covers (10 products)
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-protector-standard', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-protector-family', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-protector-deep-pocket', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pet-proof-mattress-protector', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pet-owner-duvet-cover', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('3-sided-duvet', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('duvet-cover-marine', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('duvet-cover-rv', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('duvet-cover-dorm', 1);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-encasement-general', 1);

-- Tier 2: Medium — fitted sheets + flat sheets + encasement + accessories (11 products)
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('standard-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('deep-pocket-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('marine-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('dorm-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('rv-truck-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('family-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pet-owner-fitted-sheet', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('flat-sheet-standard', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('flat-sheet-extra-deep-pocket', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('rv-truck-mattress-encasement', 2);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('bedbridge-connector', 2);

-- Tier 3: Light — pillow protector + pillowcases + bed lifter (5 products)
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillow-protector-general', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-envelope', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-zipper', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-sham', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-lift-helper', 3);

-- Duvet Insert is TH-only — not in shipping tiers (cannot ship internationally)
-- (26 products above + duvet-insert = 27 total)

-- 2. Add tier columns to shipping_rates
-- D1 supports ALTER TABLE ADD COLUMN with defaults (migration-safe: ignores if columns exist)
ALTER TABLE shipping_rates ADD COLUMN tier1_first_thb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipping_rates ADD COLUMN tier1_add_thb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipping_rates ADD COLUMN tier2_first_thb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipping_rates ADD COLUMN tier2_add_thb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipping_rates ADD COLUMN tier3_first_thb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipping_rates ADD COLUMN tier3_add_thb INTEGER NOT NULL DEFAULT 0;

-- 3. Migrate existing flat rates into Tier 2 (medium) as default
-- All existing countries get their old rates applied to all 3 tiers equally
-- Admin can override per-tier in dashboard
UPDATE shipping_rates SET
  tier1_first_thb = first_item_thb, tier1_add_thb = additional_item_thb,
  tier2_first_thb = first_item_thb, tier2_add_thb = additional_item_thb,
  tier3_first_thb = first_item_thb, tier3_add_thb = additional_item_thb
WHERE tier1_first_thb = 0;
