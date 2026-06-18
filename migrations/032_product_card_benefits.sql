-- Add editable short card-benefit fields for dynamic listing cards
ALTER TABLE products ADD COLUMN card_benefit_en TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN card_benefit_th TEXT DEFAULT '';

-- Seed EN card-benefit lines from /products/ cards
UPDATE products SET card_benefit_en = 'Made to fit standard mattresses with a smooth, secure finish.' WHERE slug = 'standard-fitted-sheet';
UPDATE products SET card_benefit_en = 'Designed for tall mattresses, toppers, and extra-deep setups.' WHERE slug = 'deep-pocket-fitted-sheet';
UPDATE products SET card_benefit_en = 'Custom-fit for V-berths and unusual boat mattress shapes.' WHERE slug = 'marine-fitted-sheet';
UPDATE products SET card_benefit_en = 'Made for dormitory and overseas student-bed dimensions.' WHERE slug = 'dorm-fitted-sheet';
UPDATE products SET card_benefit_en = 'Designed for compact vehicle mattresses and sleeper cabins.' WHERE slug = 'rv-truck-fitted-sheet';
UPDATE products SET card_benefit_en = 'A seamless fitted sheet for joined and oversized family beds.' WHERE slug = 'family-fitted-sheet';
UPDATE products SET card_benefit_en = 'BreezePlus fabric - scratch-resistant and easy to brush off pet hair.' WHERE slug = 'pet-owner-fitted-sheet';
UPDATE products SET card_benefit_en = 'Classic flat sheet styling for home and hotel setups.' WHERE slug = 'flat-sheet-standard';
UPDATE products SET card_benefit_en = 'Oversized flat sheet designed for tall, layered mattresses.' WHERE slug = 'flat-sheet-extra-deep-pocket';
UPDATE products SET card_benefit_en = 'Oversized duvet cover with a 3-sided zipper for easy insertion.' WHERE slug = '3-sided-duvet';
UPDATE products SET card_benefit_en = 'BreezePlus fabric protecting against pet hair and claws.' WHERE slug = 'pet-owner-duvet-cover';
UPDATE products SET card_benefit_en = 'Custom-shaped duvet cover designed for compact boat cabins.' WHERE slug = 'duvet-cover-marine';
UPDATE products SET card_benefit_en = 'Custom duvet cover to fit vehicle and sleeping berths.' WHERE slug = 'duvet-cover-rv';
UPDATE products SET card_benefit_en = 'Sized perfectly for dormitory and student-accommodation inserts.' WHERE slug = 'duvet-cover-dorm';
UPDATE products SET card_benefit_en = 'Fluffy and lightweight duvet insert for perfect temperature control.' WHERE slug = 'duvet-insert';
UPDATE products SET card_benefit_en = 'Classic fold-over envelope design for easy pillow changing.' WHERE slug = 'pillowcase-envelope';
UPDATE products SET card_benefit_en = 'Fully zipped closure, protecting pillow against dust mites.' WHERE slug = 'pillowcase-zipper';
UPDATE products SET card_benefit_en = 'Decorative border styling for a luxury hotel appearance.' WHERE slug = 'pillowcase-sham';
UPDATE products SET card_benefit_en = 'Water-resistant barrier shield that protects standard mattresses.' WHERE slug = 'mattress-protector-standard';
UPDATE products SET card_benefit_en = 'Seamless protective layer for oversized co-sleeping beds.' WHERE slug = 'mattress-protector-family';
UPDATE products SET card_benefit_en = 'Fits extra-tall pocket depths with full elastic skirt protection.' WHERE slug = 'mattress-protector-deep-pocket';
UPDATE products SET card_benefit_en = 'Scratch-resistant heavy shield against pet urine and claws.' WHERE slug = 'pet-proof-mattress-protector';
UPDATE products SET card_benefit_en = 'Waterproof 3-layer protection tailored for V-berth and marine mattress dimensions.' WHERE slug = 'marine-mattress-protector';
UPDATE products SET card_benefit_en = 'Full 6-sided zippered protection against moisture and dust mites.' WHERE slug = 'mattress-encasement-general';
UPDATE products SET card_benefit_en = 'Heavy zippered protector designed for mobile cabin mattresses.' WHERE slug = 'rv-truck-mattress-encasement';
UPDATE products SET card_benefit_en = 'Zipped moisture shield extending the lifetime of your pillow.' WHERE slug = 'pillow-protector-general';
UPDATE products SET card_benefit_en = 'Connects two mattress pads seamlessly with a center bridge foam.' WHERE slug = 'bedbridge-connector';
UPDATE products SET card_benefit_en = 'Ergonomic wedge lifter making bedsheet changing effortless.' WHERE slug = 'mattress-lift-helper';
