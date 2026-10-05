-- MildMate Migration 054
-- Marketing Decision System — Phase 14: Opportunity & Decision Engine
-- Additive only: opportunity score snapshots + model registry + modeled-price
-- column on the Phase 13 cost register. No canonical table is altered beyond
-- the additive column; no operational table is touched.
--
-- Owner decisions encoded here (approved 2026-10-02):
--   v1 weights: momentum 30, profitability 30, channel_fit 20, demand 15,
--               strategic 5 (NULL until the owner defines the rule),
--               conversion 0 until GA4 funnel events are populated.
--   A NULL/insufficient component is NEVER counted as zero: scores are
--   normalized by the available component weight, and every row stores
--   available_weight, missing-component flags, and a Data Confidence score.
--   Profitability is MODELED (Phase 13 formula-derived at the approved
--   reference size), labeled ESTIMATED — never realized per-product margin
--   (item revenue is 100% UNALLOCATED; order revenue is never allocated to
--   products and never equal-split).
--   One canonical snapshot per (score_date, model_version, product_id,
--   channel): a same-day rerun replaces that day's snapshot.
--   Score history is retained for auditability and trend analysis.
--   Weight changes are VERSIONED (new opportunity_score_models row), never a
--   silent change to the v1 formula.

-- ── Modeled reference selling price on the Phase 13 cost register ─────────
-- Filled by POST /api/admin/cost-model/recalculate (formula rows only):
-- the formula price at the same approved reference size (standard-size path,
-- ceil-100 rounding, family margin from live pricing_params; weighted duvet
-- includes the derived markup). Verified-cost-only products (no formula)
-- keep NULL and their profitability component stays NULL (never zero).

ALTER TABLE cost_model_products ADD COLUMN modeled_price_thb REAL;

-- ── Model registry (versioned weights, auditability) ─────────────────────

CREATE TABLE IF NOT EXISTS opportunity_score_models (
  model_version TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO opportunity_score_models (model_version, weights_json, notes) VALUES
  ('v1',
   '{"momentum":30,"profitability":30,"channel_fit":20,"demand":15,"strategic":5,"conversion":0,"demand_ga4":80,"demand_gsc":20}',
   'Phase 14 v1 (2026-10-02): strategic=NULL until owner defines the rule (weight redistributes); conversion=0 until GA4 funnel events populate. Profitability = MODELED margin (Phase 13 formula-derived, ESTIMATED). Demand sub-weights GA4 80 / GSC 20 (owner amendment 2026-10-02: GSC too thin for 40; raise via a new model version once GSC coverage improves). GA4 demand is website-property scoped (migration 055); Etsy GA4 feeds Etsy channel rows only. Confidence carries a flat -15 modeled-margin basis and per-source mapping/staleness/volume deductions. Tier grades the SCORE (HIGH >=70, MEDIUM >=45, LOW >=25) and is only issued when confidence >= 25; rows with no available component or confidence <25 are INSUFFICIENT_DATA (no score).');

-- ── Score snapshots (history kept; same-day rerun replaces) ────────────────

CREATE TABLE IF NOT EXISTS opportunity_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score_date TEXT NOT NULL,                       -- UTC compute date (YYYY-MM-DD)
  score_model_version TEXT NOT NULL,             -- e.g. 'v1'
  product_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT '',               -- '' = product-overall row
  score REAL,                                    -- 0-100; NULL when INSUFFICIENT_DATA
  rank INTEGER,                                  -- rank within scope for this date
  tier TEXT NOT NULL,                            -- 'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT_DATA'
  confidence REAL,                               -- 0-100 data confidence
  components_json TEXT NOT NULL DEFAULT '{}',    -- per-component raw/normalized/weight/flags
  available_weight REAL NOT NULL DEFAULT 0,      -- sum of weights that produced a value
  missing_components TEXT NOT NULL DEFAULT '',   -- comma list, never silently zeroed
  reasons TEXT NOT NULL DEFAULT '',              -- human-readable explanation
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(score_date, score_model_version, product_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_scores_latest
  ON opportunity_scores(score_model_version, score_date DESC, channel, rank);

CREATE INDEX IF NOT EXISTS idx_opportunity_scores_product
  ON opportunity_scores(product_id, score_date DESC);
