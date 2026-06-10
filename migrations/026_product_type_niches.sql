-- Add product_type and niches columns to products table
-- product_type: single value (sheets, duvet-covers, pillowcases, protection, accessories)
-- niches: comma-separated niche slugs (marine, family, pets, deep-pocket, boarding-dorm, rv-truck)

ALTER TABLE products ADD COLUMN product_type TEXT;
ALTER TABLE products ADD COLUMN niches TEXT;

-- Populate from existing category column (first value = product_type, rest = niches)
UPDATE products SET
  product_type = CASE
    WHEN INSTR(category, ',') > 0 THEN TRIM(SUBSTR(category, 1, INSTR(category, ',') - 1))
    ELSE TRIM(category)
  END,
  niches = CASE
    WHEN INSTR(category, ',') > 0 THEN TRIM(LTRIM(SUBSTR(category, INSTR(category, ',')), ','))
    ELSE ''
  END;
