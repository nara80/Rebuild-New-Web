-- Add Marine Mattress Protector pricing + shipping tier wiring

INSERT OR IGNORE INTO pricing_params (key, value, label, category)
VALUES ('margin_rate_protector_marine', 15, 'Marine Mattress Protector Margin Rate', 'margin');

INSERT OR IGNORE INTO products (
  slug, title_en, title_th, category, product_type, niches,
  is_active, sort_order, images, youtube_url, tags, image_url
)
VALUES (
  'marine-mattress-protector',
  'Marine Mattress Protector',
  'à¸œà¹‰à¸²à¸›à¸¹à¸à¸±à¸™à¹€à¸›à¸·à¹‰à¸­à¸™ Marine',
  'protection, marine',
  'protection',
  'marine',
  1,
  28,
  '[]',
  '',
  'protection, marine',
  '/images/products/mattress-protector-standard/main.jpg'
);

INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier)
VALUES ('marine-mattress-protector', 1);
