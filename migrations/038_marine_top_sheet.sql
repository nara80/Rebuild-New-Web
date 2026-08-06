-- Add Marine Top Sheet product (EN/TH) and shipping tier mapping

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
  is_custom,
  is_active,
  sort_order,
  image_url,
  images,
  tags,
  card_benefit_en,
  card_benefit_th
)
VALUES (
  'marine-top-sheet',
  'Marine Top Sheet',
  'ผ้าปูบนเรือทรงสั่งตัด',
  'Custom shape-matched marine top sheet for V-berth and irregular boat mattresses. Made-to-measure with CloudSoft quick-dry fabric.',
  'ผ้าปูบนเรือทรงสั่งตัดสำหรับที่นอนหัวเรือและรูปทรงพิเศษ ผลิตตามขนาดจริงด้วยผ้า CloudSoft แห้งไว',
  'sheets, marine',
  'sheets',
  'marine',
  'cloudsoft',
  48,
  1695,
  1,
  1,
  4,
  '/images/products/marine-top-sheet/main.jpg',
  '["/images/products/marine-top-sheet/main.jpg","/images/products/marine-top-sheet/how-to-order-1.jpg","/images/products/marine-top-sheet/how-to-order-2.jpg","/images/products/marine-top-sheet/problem-1.jpg","/images/products/marine-top-sheet/problem-2.jpg","/images/products/marine-top-sheet/tuck-10-inch.jpg","/images/products/marine-top-sheet/allowance-10-inch.jpg","/images/products/marine-top-sheet/easy-tucking.jpg"]',
  'sheets, marine, custom-shape, top-sheet',
  'Shape-matched pattern with tuck-under allowance for marine mattresses',
  'แพทเทิร์นเข้ารูปพร้อมเผื่อชายผ้าสำหรับสอดใต้ที่นอนเรือ'
)
ON CONFLICT(slug) DO UPDATE SET
  title_en = excluded.title_en,
  title_th = excluded.title_th,
  description_en = excluded.description_en,
  description_th = excluded.description_th,
  category = excluded.category,
  product_type = excluded.product_type,
  niches = excluded.niches,
  fabric_options = excluded.fabric_options,
  base_price_usd = excluded.base_price_usd,
  base_price_thb = excluded.base_price_thb,
  is_custom = excluded.is_custom,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  image_url = excluded.image_url,
  images = excluded.images,
  tags = excluded.tags,
  card_benefit_en = excluded.card_benefit_en,
  card_benefit_th = excluded.card_benefit_th,
  updated_at = datetime('now');

INSERT INTO shipping_product_tiers (product_slug, tier, updated_at)
VALUES ('marine-top-sheet', 2, datetime('now'))
ON CONFLICT(product_slug) DO UPDATE SET
  tier = excluded.tier,
  updated_at = datetime('now');
