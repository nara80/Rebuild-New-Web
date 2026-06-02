-- MildMate Migration 014
-- Adds Option A shipment tracking fields to orders

ALTER TABLE orders ADD COLUMN carrier_code TEXT;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN tracking_url TEXT;
ALTER TABLE orders ADD COLUMN shipping_status TEXT;
ALTER TABLE orders ADD COLUMN shipped_at DATETIME;
