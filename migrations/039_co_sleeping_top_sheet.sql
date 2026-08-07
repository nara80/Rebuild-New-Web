-- Add Co-Sleeping Top Sheet product (EN/TH) and shipping tier mapping
-- One continuous flat sheet designed to cover two side-by-side mattresses for co-sleeping families

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
  'co-sleeping-top-sheet',
  'Co-Sleeping Top Sheet',
  'ผ้าปูบน Co-Sleeping สั่งตัด',
  'Custom co-sleeping flat sheet designed to cover two side-by-side mattresses as one continuous family bed. Made-to-measure with generous 10 in / 25 cm under-tuck allowance. Available in all 4 premium fabric collections.',
  'ผ้าปูบนสั่งตัดสำหรับครอบครัว Co-Sleeping ออกแบบมาเพื่อคลุมสองที่นอนที่วางข้างกันเป็นเตียงครอบครัวผืนเดียว ผลิตตามขนาดจริงพร้อมเผื่อชายผ้า 10 นิ้ว / 25 ซม. สำหรับสอดใต้ที่นอน มีให้เลือกทั้ง 4 คอลเลกชันผ้าพรีเมียม',
  'sheets, family',
  'sheets',
  'family',
  'cloudsoft, breezeplus, premacotton, ecoluxe',
  45,
  1590,
  1,
  1,
  10,
  '/images/products/co-sleeping-top-sheet/hero.jpg',
  '["/images/products/co-sleeping-top-sheet/hero.jpg","/images/products/co-sleeping-top-sheet/main.jpg"]',
  'sheets, family, co-sleeping, top-sheet, flat-sheet',
  'One continuous sheet covering two side-by-side mattresses with generous 10-inch under-tuck allowance',
  'ผ้าปูผืนเดียวคลุมสองที่นอนข้างกันพร้อมเผื่อชายผ้าสอดใต้ 10 นิ้ว สำหรับครอบครัว Co-Sleeping'
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
VALUES ('co-sleeping-top-sheet', 2, datetime('now'))
ON CONFLICT(product_slug) DO UPDATE SET
  tier = excluded.tier,
  updated_at = datetime('now');
