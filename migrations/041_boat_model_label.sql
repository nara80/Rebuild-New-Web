-- Persist combined boat model + year label (e.g. "SeaRay 340 Sundancer - 2007")
-- Keeps lookup-friendly split columns while storing canonical combined label in D1

ALTER TABLE boat_models ADD COLUMN model_label TEXT;

UPDATE boat_models
SET model_label = CASE
  WHEN model_year IS NOT NULL AND model_year > 0 THEN trim(model_name) || ' - ' || CAST(model_year AS TEXT)
  ELSE trim(model_name)
END
WHERE model_label IS NULL OR trim(model_label) = '';

CREATE INDEX IF NOT EXISTS idx_boat_models_label ON boat_models(model_label);
