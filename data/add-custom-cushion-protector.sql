-- 2026-09-02: Add Custom Spill-Proof Cushion Protector (placeholder image launch)
-- Phase rollout: TPU cost + fitted-sheet formula path + dedicated margin param key

CREATE TABLE IF NOT EXISTS product_niches (
  product_id INTEGER NOT NULL,
  niche_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, niche_type)
);

CREATE TABLE IF NOT EXISTS product_collections (
  product_id INTEGER NOT NULL,
  collection_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, collection_type)
);

CREATE TABLE IF NOT EXISTS shipping_product_tiers (
  product_slug TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 2,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (
  slug,
  title_en,
  title_th,
  description_en,
  description_th,
  category,
  product_type,
  niches,
  fabric_options,
  base_price_usd,
  base_price_thb,
  image_url,
  tags,
  is_custom,
  is_active,
  sort_order
)
VALUES (
  'custom-waterproof-cushion-protector',
  'Custom Spill-Proof Cushion Protector',
  'Custom Spill-Proof Cushion Protector',
  '<h3>Custom Spill-Proof Protection for Specialty Cushions</h3><p>A made-to-measure TPU inner protector designed for sofa cushions, ottomans, bench cushions, RV cushions, boat cushions, and other non-standard shapes. The fitted design covers the top and four sides while leaving most of the underside open for practical daily use.</p><ul><li>Custom made to your exact Width × Length × Thickness</li><li>Spill-proof TPU barrier for everyday accidents</li><li>360° elastic edge for secure fitted hold</li><li>Open-bottom construction for easier installation</li><li>Designed to sit under your decorative outer cover</li></ul><h3>Construction & Fit Notes</h3><p>This is a protective inner layer, not a decorative outer cover. The fitted 360° elastic edge needs about 2 in / 5 cm underside access to tuck and grip properly, especially on attached ottoman or fixed cushions.</p><ul><li>Top + four sides covered, bottom mostly open</li><li>Approx. 2 in / 5 cm tuck-under recommended</li><li>Use as: Cushion → TPU Protector → Outer Cover</li><li>Alternative by request: fully enclosed 3-sided zipper style</li></ul>',
  '',
  'protection',
  'protection',
  'marine,family,pets,deep-pocket,boarding-dorm,rv-truck',
  'tpu',
  38,
  1345,
  '/images/placeholder.jpg',
  'Cushion Protector,Spill-Proof,TPU,Custom Size',
  1,
  1,
  28
)
ON CONFLICT(slug) DO UPDATE SET
  title_en = excluded.title_en,
  title_th = excluded.title_th,
  description_en = excluded.description_en,
  category = excluded.category,
  product_type = excluded.product_type,
  niches = excluded.niches,
  fabric_options = excluded.fabric_options,
  base_price_usd = excluded.base_price_usd,
  base_price_thb = excluded.base_price_thb,
  image_url = excluded.image_url,
  tags = excluded.tags,
  is_custom = excluded.is_custom,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = datetime('now');

-- Keep taxonomy split tables aligned
DELETE FROM product_niches
WHERE product_id = (SELECT id FROM products WHERE slug = 'custom-waterproof-cushion-protector');

INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'marine' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'family' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'pets' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'deep-pocket' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'boarding-dorm' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_niches (product_id, niche_type)
SELECT id, 'rv-truck' FROM products WHERE slug = 'custom-waterproof-cushion-protector';

DELETE FROM product_collections
WHERE product_id = (SELECT id FROM products WHERE slug = 'custom-waterproof-cushion-protector');

INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'marine' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'family' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'pets' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'deep-pocket' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'boarding-dorm' FROM products WHERE slug = 'custom-waterproof-cushion-protector';
INSERT OR IGNORE INTO product_collections (product_id, collection_type)
SELECT id, 'rv-truck' FROM products WHERE slug = 'custom-waterproof-cushion-protector';

-- Shipping defaults: Tier 2 medium bedding class
INSERT INTO shipping_product_tiers (product_slug, tier, updated_at)
VALUES ('custom-waterproof-cushion-protector', 2, datetime('now'))
ON CONFLICT(product_slug) DO UPDATE SET tier = excluded.tier, updated_at = excluded.updated_at;

-- Super Admin Pricing Parameters: dedicated margin knob for this SKU
INSERT INTO pricing_params (key, value, label, category)
VALUES ('margin_rate_cushion_protector', 30, 'Margin Rate — Cushion Protector (%)', 'margin')
ON CONFLICT(key) DO UPDATE SET
  label = excluded.label,
  category = excluded.category;
