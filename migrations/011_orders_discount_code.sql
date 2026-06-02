-- MildMate Migration 011
-- Adds discount_code column to orders table

ALTER TABLE orders ADD COLUMN discount_code TEXT;
