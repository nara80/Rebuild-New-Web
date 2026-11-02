-- 044_product_mapping_events.sql
-- Phase 07 v2 (Marketing Decision System): audit history for the direct
-- Notion product mapper. Every mapping decision (including dry runs and
-- Review Required outcomes) is preserved for traceability.
-- Additive only; no existing tables are modified.

CREATE TABLE IF NOT EXISTS product_mapping_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notion_page_id TEXT,
  source_order_id TEXT,
  source_system TEXT,
  raw_product_text TEXT,                    -- original Product_Info/ProductJSON excerpt (truncated, PII-free)
  previous_product_ids TEXT,                -- D1_Product_IDs value before this event
  resolved_product_ids TEXT,                -- JSON array of resolved D1 product ids
  mapping_method TEXT,                      -- EXACT_VARIATION | EXACT_ALIAS | LISTING_VARIATION | RULE | AI | HUMAN
  confidence REAL,
  result_status TEXT,                       -- Mapped | Partial | Review Required | Unmapped
  dry_run INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_mapping_events_order
  ON product_mapping_events (source_order_id);

CREATE INDEX IF NOT EXISTS idx_product_mapping_events_page
  ON product_mapping_events (notion_page_id);
