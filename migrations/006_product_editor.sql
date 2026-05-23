-- Migration 006: Product Editor Fields
-- Adds product editing fields for admin dashboard

ALTER TABLE products ADD COLUMN youtube_url TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]';
