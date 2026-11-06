-- Phase 16: AI Analyst & Marketing Action Feedback Loop
-- Additive only. AI is advisory: rows are recommendations that require
-- explicit human approval before any execution tracking. AI never writes
-- canonical product/sales facts through this table.

CREATE TABLE IF NOT EXISTS marketing_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_date TEXT NOT NULL,                -- date the recommendation was generated (YYYY-MM-DD)
  source TEXT NOT NULL DEFAULT 'ai',        -- ai | human (audit: AI-generated vs human-authored)
  ai_model TEXT,                            -- model identifier when source = 'ai'
  status TEXT NOT NULL DEFAULT 'proposed',  -- proposed | approved | rejected | reviewed
  product_id INTEGER,                       -- canonical D1 products.id (NULL for non-product actions)
  channel TEXT,                             -- channel slug; '' = overall
  action_type TEXT,                         -- e.g. push_product | campaign | content | monitor
  title TEXT NOT NULL,
  detail TEXT,                              -- "Why" reasoning summary (traceable to cited metrics only)
  recommendation_json TEXT,                 -- full structured recommendation as validated
  baseline_metrics_json TEXT,               -- snapshot captured at approval time
  post_metrics_json TEXT,                   -- snapshot captured at review time
  approved_budget REAL,                     -- human-approved spend envelope (planning only; never auto-spent)
  budget_currency TEXT DEFAULT 'THB',
  success_target TEXT,
  confidence REAL,                          -- 0-100 from the validated recommendation
  caution INTEGER NOT NULL DEFAULT 0,       -- 1 = data confidence insufficient/stale -> cautious recommendation
  caution_note TEXT,
  review_date TEXT,                         -- suggested result-review date
  result_class TEXT,                        -- positive | neutral | negative | inconclusive
  lessons TEXT,
  approved_by TEXT,
  approved_at TEXT,
  rejected_by TEXT,
  rejected_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_actions_status ON marketing_actions(status, action_date);
CREATE INDEX IF NOT EXISTS idx_marketing_actions_product ON marketing_actions(product_id);
CREATE INDEX IF NOT EXISTS idx_marketing_actions_reviewed ON marketing_actions(status, reviewed_at);
