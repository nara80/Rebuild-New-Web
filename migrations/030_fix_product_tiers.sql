-- Seed shipping_product_tiers (was rolled back from migration 027)
-- All 26 shippable products (duvet-insert is TH-only)

-- Tier 1: Heavy — protectors + duvet covers
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

-- Tier 2: Medium — fitted sheets + flat sheets + encasement + bedbridge
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

-- Tier 3: Light — pillowcases + pillow protector + bed lifter
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillow-protector-general', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-envelope', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-zipper', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('pillowcase-sham', 3);
INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier) VALUES ('mattress-lift-helper', 3);

-- Reset global add rates to correct defaults
INSERT INTO shipping_add_rates (tier, add_thb, updated_at) VALUES (1, 600, datetime('now')) ON CONFLICT(tier) DO UPDATE SET add_thb=600, updated_at=datetime('now');
INSERT INTO shipping_add_rates (tier, add_thb, updated_at) VALUES (2, 450, datetime('now')) ON CONFLICT(tier) DO UPDATE SET add_thb=450, updated_at=datetime('now');
INSERT INTO shipping_add_rates (tier, add_thb, updated_at) VALUES (3, 150, datetime('now')) ON CONFLICT(tier) DO UPDATE SET add_thb=150, updated_at=datetime('now');
