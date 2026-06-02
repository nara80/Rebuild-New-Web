-- Fix fabric_options per user's correct assignments
-- Pillow Protector → TPU (currently wrong: all 4 fabrics)
UPDATE products SET fabric_options = 'tpu' WHERE slug = 'pillow-protector-general';

-- 4 Mattress Protectors → Other (3-Layer: Cotton Quilted + Polyester Filling + TPU Waterproof)
-- Currently: 3 are 'tpu', 1 is 'breezeplus' — all wrong
UPDATE products SET fabric_options = 'other' WHERE slug IN ('mattress-protector-standard','mattress-protector-family','mattress-protector-deep-pocket','pet-proof-mattress-protector');
