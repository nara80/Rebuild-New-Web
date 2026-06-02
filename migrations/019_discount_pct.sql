-- Migration 019: Add discount_pct column to discount_claims
-- Required for multi-percentage codes (abandoned cart recovery: 10%, favorites: 15%, thank-you: 20%)
-- Previously hardcoded to 15% in validate — now reads per-code

ALTER TABLE discount_claims ADD COLUMN discount_pct INTEGER DEFAULT 15;
