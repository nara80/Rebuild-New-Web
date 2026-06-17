-- MildMate Migration 022
-- Renames order_minimum_thb to order_minimum_usd on promo_codes
-- Admin inputs USD minimum; workers validate against cart_total_usd

ALTER TABLE promo_codes RENAME COLUMN order_minimum_thb TO order_minimum_usd;
