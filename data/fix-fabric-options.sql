-- Fix fabric_options per user's correct assignments
-- Pillow Protector → TPU (currently wrong: all 4 fabrics)
UPDATE products SET fabric_options = 'tpu' WHERE slug = 'pillow-protector-general';

-- Mattress Protectors fabric locks
-- Standard/Family/Deep Pocket use 3-layer protector construction with locked TPU material class
UPDATE products SET fabric_options = 'tpu' WHERE slug IN ('mattress-protector-standard','mattress-protector-family','mattress-protector-deep-pocket');

-- Pet-Proof uses the same 3-layer protector concept but with BreezePlus top fabric positioning
UPDATE products SET fabric_options = 'breezeplus' WHERE slug = 'pet-proof-mattress-protector';
