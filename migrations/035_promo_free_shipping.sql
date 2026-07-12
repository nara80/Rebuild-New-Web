-- MildMate Migration 035
-- Adds free_shipping flag to promo_codes
-- When free_shipping = 1, checkout does not charge shipping for that order

ALTER TABLE promo_codes ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0;
