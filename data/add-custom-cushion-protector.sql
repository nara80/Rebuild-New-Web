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
  faq_en,
  faq_th,
  card_benefit_en,
  card_benefit_th,
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
  'Custom Spill-Proof Cushion Protector with 360° Elastic Fit',
  'ปลอกกันน้ำกันหกหุ้มเบาะสั่งตัด พร้อมขอบยางยืดรอบด้าน',
  '<h3>Custom Spill-Proof Cushion Protector</h3><p>Designed for sofa, ottoman, bench, RV, and boat cushions, this made-to-measure TPU inner protector helps manage everyday spills while keeping a secure fitted hold.</p><ul><li>360° elastic fitted edge for stable placement</li><li>Spill-proof TPU barrier for daily accidents</li><li>Covers top and side panels for practical protection</li><li>Open-bottom construction for easier on and off</li><li>Custom size by Width × Length × Thickness</li><li>Use under your decorative outer cushion cover</li><li>Made to order in Thailand</li></ul><p>For custom size, measure the cushion itself and provide width, length, and thickness in cm or inch. Outer decorative cover is not included.</p>',
  '<h3>ปลอกกันน้ำกันหกหุ้มเบาะสั่งตัด</h3><p>ออกแบบสำหรับเบาะโซฟา เบาะออตโตมัน เบาะม้านั่ง เบาะ RV และเบาะเรือ ปลอกชั้นใน TPU แบบสั่งตัดนี้ช่วยรับมือการหกเลอะในชีวิตประจำวัน พร้อมความกระชับจากขอบยางยืดรอบด้าน</p><ul><li>ขอบยางยืดรอบด้าน 360° ช่วยให้กระชับและอยู่ทรง</li><li>ชั้น TPU กันน้ำ ช่วยป้องกันการหกเลอะทั่วไป</li><li>ปกป้องด้านบนและด้านข้างของเบาะเพื่อการใช้งานจริง</li><li>ดีไซน์เปิดใต้ท้องเบาะ ช่วยให้ถอดใส่ง่าย</li><li>สั่งตัดตามขนาดจริง กว้าง × ยาว × หนา</li><li>ใช้เป็นชั้นในใต้ปลอกตกแต่งภายนอก</li><li>ผลิตตามสั่งในประเทศไทย</li></ul><p>กรณีสั่งขนาดพิเศษ ให้วัดจากตัวเบาะจริงและระบุความกว้าง ความยาว และความหนาเป็น cm หรือ inch สินค้านี้ไม่รวมปลอกตกแต่งภายนอก</p>',
  '<details open=""><summary>How do I choose the correct size?</summary><p>Measure the cushion itself and provide width, length, and thickness. Do not use mattress dimensions.</p></details><details><summary>Which cushion types does this protector support?</summary><p>Sofa cushions, ottoman cushions, bench cushions, RV cushions, boat cushions, and other non-standard cushion shapes.</p></details><details><summary>Does it fully enclose the cushion?</summary><p>Default construction covers the top and sides with an open bottom for easier installation. A fully enclosed 3-sided zipper style is available by request.</p></details><details><summary>What is included in the order?</summary><p>1 custom TPU inner spill-proof cushion protector. Decorative outer cushion cover is not included.</p></details>',
  '<details><summary>วัดจากขนาดเบาะหรือขนาดที่นอน?</summary><p>วัดจากขนาดเบาะจริง โดยใช้ความกว้าง × ความยาว × ความหนา ไม่ใช่ขนาดที่นอน</p></details><details><summary>รองรับเบาะประเภทใดบ้าง?</summary><p>รองรับเบาะโซฟา เบาะออตโตมัน เบาะม้านั่ง เบาะ RV เบาะเรือ และเบาะทรงพิเศษอื่น ๆ</p></details><details><summary>ปลอกหุ้มรอบทั้งชิ้นหรือไม่?</summary><p>รูปแบบมาตรฐานจะปกป้องด้านบนและด้านข้าง พร้อมเปิดใต้ท้องเบาะเพื่อถอดใส่ง่าย หากต้องการแบบปิดทั้งชิ้นสามารถสั่งแบบซิป 3 ด้านได้</p></details><details><summary>สินค้าในชุดมีอะไรบ้าง?</summary><p>ปลอกชั้นใน TPU กันน้ำกันหกแบบสั่งตัด 1 ชิ้น ไม่รวมปลอกตกแต่งภายนอก</p></details>',
  'Custom spill-proof TPU cushion protector with 360° elastic fit and made-to-measure sizing.',
  'ปลอกกันน้ำกันหกหุ้มเบาะ TPU แบบสั่งตัด พร้อมขอบยางยืดรอบด้าน 360°',
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
  description_th = excluded.description_th,
  faq_en = excluded.faq_en,
  faq_th = excluded.faq_th,
  card_benefit_en = excluded.card_benefit_en,
  card_benefit_th = excluded.card_benefit_th,
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
