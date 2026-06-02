-- MildMate Migration 010
-- Adds expiry date and source tracking to discount_claims
-- Enables newsletter subscriber promo codes with 6-month expiry

ALTER TABLE discount_claims ADD COLUMN expires_at DATETIME;
ALTER TABLE discount_claims ADD COLUMN source TEXT DEFAULT 'subscribe';

-- Set default expiry for any existing codes (6 months from now)
UPDATE discount_claims SET expires_at = datetime('now', '+6 months') WHERE expires_at IS NULL;
