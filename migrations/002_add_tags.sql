-- Migration: Add tags column to products table
-- Run with: npx wrangler d1 execute mildmate-db --file=migrations/002_add_tags.sql --remote

ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '';
