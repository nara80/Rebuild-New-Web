-- Migration 037
-- Boat model knowledge base for Marine Fitted Sheet auto-fill

CREATE TABLE IF NOT EXISTS boat_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  shape_code TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_boat_models_active ON boat_models(is_active);
CREATE INDEX IF NOT EXISTS idx_boat_models_shape ON boat_models(shape_code);
