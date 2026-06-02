-- Seed correct fabric_options from product-content.json
UPDATE products SET fabric_options = 'cloudsoft,breezeplus,premacotton,ecoluxe' WHERE slug IN ('standard-fitted-sheet','deep-pocket-fitted-sheet','dorm-fitted-sheet','family-fitted-sheet','flat-sheet-standard','flat-sheet-extra-deep-pocket','3-sided-duvet','duvet-cover-dorm','pillowcase-envelope','pillowcase-zipper','pillowcase-sham','pillow-protector-general');
UPDATE products SET fabric_options = 'cloudsoft' WHERE slug IN ('marine-fitted-sheet','rv-truck-fitted-sheet','duvet-cover-marine','duvet-cover-rv');
UPDATE products SET fabric_options = 'breezeplus' WHERE slug IN ('pet-owner-fitted-sheet','pet-owner-duvet-cover','pet-proof-mattress-protector');
UPDATE products SET fabric_options = 'tpu' WHERE slug IN ('mattress-encasement-general','rv-truck-mattress-encasement','mattress-protector-standard','mattress-protector-family','mattress-protector-deep-pocket');
UPDATE products SET fabric_options = 'other' WHERE slug IN ('bedbridge-connector','mattress-lift-helper','duvet-insert');
