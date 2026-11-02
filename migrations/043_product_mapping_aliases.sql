-- 043_product_mapping_aliases.sql
-- Phase 07 (Marketing Decision System): reusable D1 mapping memory for the
-- Notion Order Product Mapper. Stores verified listing/variation/alias
-- mappings to canonical D1 product ids so human corrections become reusable.
-- Additive only; no existing tables are modified.

CREATE TABLE IF NOT EXISTS product_mapping_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_system TEXT,                              -- normalized channel ('etsy', 'shopee', ...); NULL = applies to any source
  listing_id TEXT,                                 -- marketplace listing / parent id when known
  alias_text TEXT NOT NULL,                        -- original human-readable alias (variation or listing text, preserved as given)
  alias_norm TEXT NOT NULL,                        -- normalized match key (lowercase, collapsed whitespace, alphanumerics)
  product_ids TEXT NOT NULL,                       -- JSON array of canonical D1 product ids, e.g. [20,26]
  match_scope TEXT NOT NULL DEFAULT 'alias',       -- 'variation' | 'listing' | 'alias'
  verified INTEGER NOT NULL DEFAULT 0,             -- 1 = human-verified mapping memory
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_mapping_aliases_key
  ON product_mapping_aliases (COALESCE(source_system, ''), COALESCE(listing_id, ''), alias_norm);

CREATE INDEX IF NOT EXISTS idx_product_mapping_aliases_listing
  ON product_mapping_aliases (listing_id);

-- Seed the known verification case from the Phase 07 checklist:
-- known ID 1038 resolves to D1 products 20 + 26.
INSERT INTO product_mapping_aliases
  (source_system, listing_id, alias_text, alias_norm, product_ids, match_scope, verified, notes)
SELECT NULL, '1038', '1038', '1038', '[20,26]', 'listing', 1,
       'Phase 07 checklist verification case: known ID 1038 maps to D1 20 + 26'
WHERE NOT EXISTS (
  SELECT 1 FROM product_mapping_aliases
  WHERE COALESCE(source_system, '') = '' AND COALESCE(listing_id, '') = '1038' AND alias_norm = '1038'
);
