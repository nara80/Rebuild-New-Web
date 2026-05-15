-- Migration: Seed product data with tags
-- Run with: npx wrangler d1 execute mildmate-db --file=migrations/003_seed_products.sql --remote
-- IMPORTANT: Run 002_add_tags.sql FIRST before this file

-- =============================================
-- Product Tags Reference
-- =============================================
-- Tags represent the CROSS-SELL categories that appear as small tags
-- under each product card in the listing pages.
-- A product can belong to MULTIPLE cross-sell categories.
--
-- Available cross-sell tags:
--   Fitted Sheets | Flat Sheets | Duvet | Marine
--   Family        | Pets        | Protection | RV-Truck
--   Pillowcases   | Mattress Protectors
-- =============================================

DELETE FROM products WHERE 1=1;

INSERT INTO products (slug, title_en, title_th, description_en, description_th, category, fabric_options, base_price_usd, base_price_thb, image_url, is_custom, is_active, tags, sort_order) VALUES

-- === DUVET COVERS ===
(
  '3-sided-duvet',
  '3-Sided Zipper Duvet Cover',
  'ผ้าปูอุดมคติ3ด้านซิป',
  'The 3-sided zipper duvet cover opens on three sides — you never have to fight the duvet into a corner again. Just lay the cover flat, drop the duvet in, zip it up. Especially useful for pet owners who need to wash the cover frequently, or anyone who shares a bed and wants an easy way to swap the duvet on laundry day. Available in all BreezePlus colors.',
  'ผ้าปูอุดมคติ3ด้านซิป เปิดได้3ด้าน — คุณไม่ต้องต่อสู้กับผ้าคลุมเตียงอีกต่อไป แค่วางผ้าคลุมแบบแบน วางผ้าขนเล่าเข้าไป รบซิปปิด เหมาะสำหรับเจ้าของสัตว์เลี้ยงที่ต้องซักบ่อยหรือใครก็ตามที่แบ่งเตียงและต้องการเปลี่ยนผ้าขนในวันซัก ใช้งานง่าย',
  'duvet',
  'BreezePlus',
  65, 2295,
  '/images/products/3-sided-duvet.jpg',
  1, 1,
  'Family, Duvet, Marine, Pets',
  1
),

-- === FITTED SHEETS ===
(
  'family-co-sleeping-solutions-th-size',
  'Custom Family Fitted Sheet',
  'ผ้าปูที่นอนกลางครอบครัว',
  'Custom-sized fitted sheets designed for family co-sleeping arrangements and extra-large beds. Connect two or more standard sheets with our BedBridge Connector for seamless family sleeping. Available in all 4 fabric collections.',
  'ผ้าปูที่นอนขนาดพิเศษสำหรับการนอนร่วมครอบครัวและเตียงขนาดใหญ่พิเศษ เชื่อมต่อผ้าปู2ตัวหรือมากกว่าด้วย BedBridge Connector ของเราเพื่อการนอนร่วมครอบครัวที่ไม่มีรอยต่อ ใช้งานได้กับผ้าทั้ง4รุ่น',
  'fitted',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  45, 1590,
  '/images/products/family-co-sleeping-solutions-th-size.jpg',
  1, 1,
  'Family, Fitted Sheets',
  2
),

(
  'product-boat-bedding-fitted-sheet-microfiber',
  'Marine Fitted Sheet (V-Berth)',
  'ผ้าปูที่นอนเรือV-Berth',
  'Custom-made V-Berth fitted sheets for boats and yachts. Trapezoidal cut to match the tapered hull shape — no more bunching, no more gaps. Made with moisture-resistant CloudSoft microfiber that handles salt air and humidity with ease.',
  'ผ้าปูที่นอนV-Berthสำหรับเรือและเรือยอทช์ ตัดเป็นรูปสี่เหลี่ยมคางหมูให้เข้ากับรูปทรงตัวเรือ — ไม่มีรอยยับ ไม่มีช่องว่าง ผลิตจากไมโครไฟเบอร์ CloudSoft ที่ทนความชื้นและอากาศเค็มได้ดีเยี่ยม',
  'marine',
  'CloudSoft',
  55, 1945,
  '/images/products/product-boat-bedding-fitted-sheet-microfiber.jpg',
  1, 1,
  'Marine, Fitted Sheets',
  3
),

(
  'pet-owner-fitted-sheet',
  'Pet Owner Fitted Sheet',
  'ผ้าปูที่นอนสำหรับเจ้าของสัตว์เลี้ยง',
  'BreezePlus fabric fitted sheet — pet hair slides right off, resistant to claws and paws, and stays 3-5°C cooler than cotton. Machine washable, quick dry, no special care needed. Perfect for households with dogs, cats, or other furry friends.',
  'ผ้าปูที่นอนผ้าขนสัตว์ BreezePlus — ขนสัตว์ลื่นออกทันที ทนต่อเล็บและอุ้งเท้า และเย็นกว่าผ้าฝ้าย3-5°C ซักเครื่องได้ แห้งเร็ว ไม่ต้องดูแลพิเศษ เหมาะสำหรับบ้านที่มีสุนัข แมว หรือเพื่อนขนฟู',
  'fitted',
  'BreezePlus',
  48, 1695,
  '/images/products/pet-owner-fitted-sheet.jpg',
  1, 1,
  'Pets, Fitted Sheets',
  4
),

(
  'adjustable-mattress-fitted-sheet',
  'Adjustable Mattress Fitted Sheet',
  'ผ้าปูที่นอนปรับได้',
  'Designed for adjustable base beds — the fitted sheet moves with the mattress as it bends and raises. Deep pocket design (up to 50cm / 20") accommodates the full range of motion without popping off. Available in all 4 fabric collections.',
  'ออกแบบมาสำหรับเตียงปรับได้ — ผ้าปูที่นอนเคลื่อนที่ไปกับที่นอนเมื่อมันโค้งงอและยกขึ้น กระเป๋าลึก (สูงสุด50ซม./20นิ้ว) รองรับการเคลื่อนไหวทั้งหมดโดยไม่หลุด ใช้งานได้กับผ้าทั้ง4รุ่น',
  'fitted',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  42, 1485,
  '/images/products/adjustable-mattress-fitted-sheet.jpg',
  1, 1,
  'Fitted Sheets',
  5
),

-- === FLAT SHEETS ===
(
  'flat-sheet-standard',
  'Flat Sheet — Standard',
  'ผ้าปูแบนมาตรฐาน',
  'Our classic flat sheet in all 4 fabric collections. Versatile design works as a top sheet or a flat cover. OEKO-TEX certified on PremaCotton. Standard pocket depth (30cm / 12"). Great for luxury hotel-style layering.',
  'ผ้าปูแบนคลาสสิกของเราในทุกรุ่นผ้า ดีไซน์หลากหลายใช้เป็นผ้าปิดบนหรือผ้าคลุมแบน รับรอง OEKO-TEX บน PremaCotton กระเป๋าลึกมาตรฐาน (30ซม./12") เหมาะสำหรับการจัดชั้นสไตล์โรงแรมหรู',
  'flat',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  38, 1345,
  '/images/products/flat-sheet-standard.jpg',
  0, 1,
  'Flat Sheets',
  6
),

(
  'flat-sheet-extra-deep-pocket',
  'Flat Sheet — Extra Deep Pocket',
  'ผ้าปูแบนกระเป๋าลึกพิเศษ',
  'Extra deep pocket flat sheet (50cm / 20") for very thick mattresses or mattress-topper combinations. Same versatile design as our standard flat sheet, just with extra depth to accommodate pillow-top, Euro-top, and pillow-topper setups.',
  'ผ้าปูแบนกระเป๋าลึกพิเศษ (50ซม./20นิ้ว) สำหรับที่นอนหนามากหรือคอมโบที่นอนกับท็อปเปอร์ ดีไซน์เดียวกับผ้าปูแบนมาตรฐานแต่เพิ่มความลึกเพื่อรองรับ pillow-top, Euro-top และการตั้งค่าท็อปเปอร์',
  'flat',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  45, 1590,
  '/images/products/flat-sheet-extra-deep-pocket.jpg',
  0, 1,
  'Flat Sheets',
  7
),

-- === PILLOWCASES ===
(
  'pillowcase-envelope',
  'Envelope Pillowcase',
  'ซองหมอนแบบ envelope',
  'Classic envelope-style pillowcase — no zipper, no fuss. Just slip your pillow in and out. Available in all 4 fabric collections and 9-12 colors depending on fabric. Standard size (50×75cm) fits most pillows.',
  'ซองหมอนสไตล์คลาสสิกแบบ envelope — ไม่มีซิป ไม่ยุ่งยาก แค่สอดหมอนเข้าและออก ใช้งานได้กับผ้าทั้ง4รุ่นและสี9-12สีขึ้นอยู่กับผ้า ขนาดมาตรฐาน (50×75ซม.) เข้ากับหมอนส่วนใหญ่',
  'pillowcase',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  18, 635,
  '/images/products/pillowcase-envelope.jpg',
  0, 1,
  'Pillowcases',
  8
),

(
  'pillowcase-zipper',
  'Zipper Pillowcase',
  'ซองหมอนซิป',
  'Full-zipper pillowcase — 100% enclosed, keeps your pillow fully protected from dust mites, allergens, and nightly moisture. Ideal for allergy sufferers or anyone who wants maximum pillow protection. Available in all 4 fabric collections.',
  'ซองหมอนซิปเต็มรูปแบบ — ปิด100% กันไรฝุ่น สารก่อภูมิแพ้ และความชื้นทุกคืน สำหรับผู้ที่เป็นภูมิแพ้หรือใครก็ตามที่ต้องการการปกป้องหมอนสูงสุด ใช้งานได้กับผ้าทั้ง4รุ่น',
  'pillowcase',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  22, 775,
  '/images/products/pillowcase-zipper.jpg',
  0, 1,
  'Pillowcases',
  9
),

(
  'pillowcase-sham',
  'Sham Pillowcase',
  'ซองหมอน sham',
  'Decorative sham pillowcase with a hotel-quality envelope closure. Slightly larger than standard for a plump, luxurious pillow look. Works as both a protective inner and a decorative cover. Available in all 4 fabric collections.',
  'ซองหมอน sham ตกแต่งด้วยการปิดแบบ envelope คุณภาพโรงแรม ขนาดใหญ่กว่ามาตรฐานเล็กน้อยเพื่อลุคหมอนอวดหรูหรา ใช้เป็นทั้งซองปกป้องภายในและซองตกแต่งภายนอก ใช้งานได้กับผ้าทั้ง4รุ่น',
  'pillowcase',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  25, 885,
  '/images/products/pillowcase-sham.jpg',
  0, 1,
  'Pillowcases',
  10
),

-- === MATTRESS PROTECTORS ===
(
  'pet-proof-mattress-protector',
  'Pet-Proof Mattress Protector',
  'เครื่องปกป้องที่นอนกันสัตว์เลี้ยง',
  'TPU-lined waterproof mattress protector — pet urine, scratches, and accidents stay on the surface and wipe clean. Full encasement design with a zipper closure keeps the entire mattress protected. OEKO-TEX certified.',
  'เครื่องปกป้องที่นอนกันน้ำซีลTPU — ปัสสาวะสัตว์เลี้ยง รอยขีดข่วน และอุบัติเหตุอยู่บนพื้นผิวและเช็ดทำความสะอาดได้ ดีไซน์เคลือบเต็มรูปแบบพร้อมซิปปิดรอบที่นอนทั้งหมด รับรอง OEKO-TEX',
  'protection',
  'BreezePlus',
  55, 1945,
  '/images/products/pet-proof-mattress-protector.jpg',
  1, 1,
  'Pets, Protection, Mattress Protectors',
  11
),

(
  'sheet-protectors',
  '6-Sided Mattress Encasement',
  'เครื่องปกป้องที่นอน6ด้าน',
  'Full 6-sided encasement — top, bottom, and all four sides fully protected. Waterproof TPU liner inside, breathable outer fabric. Perfect for marine environments, RV beds, pet owners, and anyone needing complete mattress protection.',
  'เคลือบ6ด้าน — ด้านบน ด้านล่าง และทั้ง4ด้านข้างได้รับการปกป้องเต็มที่ เส้นใยกันน้ำTPUด้านใน ผ้านอกระบายอากาศได้ เหมาะสำหรับสภาพแวดล้อมทางทะเล เตียงรถ RV เจ้าของสัตว์เลี้ยง และใครก็ตามที่ต้องการการปกป้องที่นอนอย่างสมบูรณ์',
  'protection',
  'BreezePlus,CloudSoft',
  55, 1945,
  '/images/products/sheet-protectors.jpg',
  1, 1,
  'Marine, Protection, RV-Truck, Mattress Protectors',
  12
),

(
  'pillow-protector',
  'Pillow Protector',
  'เครื่องปกป้องหมอน',
  'TPU-lined pillow protector — waterproof, dust-mite proof, and hypoallergenic. Full zip enclosure for complete protection. Compatible with all pillow styles. Machine washable, quick dry. Available in all 4 fabric collections.',
  'เครื่องปกป้องหมอนซีลTPU — กันน้ำ กันไรฝุ่น และปลอดสารก่อภูมิแพ้ ซิปเต็มรูปแบบสำหรับการปกป้องเต็มที่ ใช้งานได้กับหมอนทุกสไตล์ ซักเครื่องได้ แห้งเร็ว ใช้งานได้กับผ้าทั้ง4รุ่น',
  'protection',
  'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  18, 635,
  '/images/products/pillow-protector.jpg',
  0, 1,
  'Protection, Pillowcases',
  13
),

-- === DUVET COVERS ===
(
  'pet-owner-duvet-cover',
  'Pet Owner Duvet Cover',
  'ผ้าคลุมเตียงสำหรับเจ้าของสัตว์เลี้ยง',
  'BreezePlus duvet cover designed specifically for pet owners — pet hair slides off, resistant to claws, and stays 3-5°C cooler than cotton. Full zipper closure keeps the duvet secure. Machine washable, quick dry, no special care needed.',
  'ผ้าคลุมเตียง BreezePlus ออกแบบมาสำหรับเจ้าของสัตว์เลี้ยง — ขนสัตว์ลื่นออกทันที ทนต่อเล็บ และเย็นกว่าผ้าฝ้าย3-5°C ซิปเต็มรูปแบบปิดผ้าขนเล่าไว้อย่างปลอดภัย ซักเครื่องได้ แห้งเร็ว ไม่ต้องดูแลพิเศษ',
  'duvet',
  'BreezePlus',
  68, 2395,
  '/images/products/pet-owner-duvet-cover.jpg',
  1, 1,
  'Pets, Duvet',
  14
),

-- === ACCESSORIES ===
(
  'tbar',
  'BedBridge Connector',
  'BedBridge Connector',
  'The BedBridge Connector joins two or more fitted sheets side-by-side — creating a seamless, gap-free sleeping surface for family co-sleeping arrangements. Adjustable buckle straps fit a wide range of mattress heights.',
  'BedBridge Connector เชื่อมต่อผ้าปูที่นอน2ตัวหรือมากกว่าด้านข้าง — สร้างพื้นผิวการนอนที่ไม่มีรอยต่อและไม่มีช่องว่างสำหรับการนอนร่วมครอบครัว เข็มขัดปรับได้เหมาะกับความสูงของที่นอนหลากหลาย',
  'accessory',
  NULL,
  35, 1235,
  '/images/products/tbar.jpg',
  0, 1,
  'Family',
  15
);
