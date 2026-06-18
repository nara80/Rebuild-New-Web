-- Add marine mattress protector dedicated pricing params
-- Option A:
-- 1) waste_factor_marine_mattress (%)
-- 2) marine_sewing_cost (THB)
-- 3) margin_rate_protector_marine (%)

INSERT OR IGNORE INTO pricing_params (key, value, label, category) VALUES
  ('waste_factor_marine_mattress', 50, 'Marine Mattress Waste (%)', 'waste'),
  ('marine_sewing_cost', 500, 'Marine Sewing Cost (THB)', 'fixed'),
  ('margin_rate_protector_marine', 15, 'Marine Protector Margin', 'margin');
