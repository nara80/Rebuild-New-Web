-- Add public-safe pricing fields for boat models
-- Keeps private dimensions in D1 while exposing only model/year/price on public UI

ALTER TABLE boat_models ADD COLUMN model_year INTEGER;
ALTER TABLE boat_models ADD COLUMN sale_price_usd REAL;

CREATE INDEX IF NOT EXISTS idx_boat_models_name_year ON boat_models(model_name, model_year);
