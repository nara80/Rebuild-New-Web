-- Add D1-backed FAQ fields for bilingual product pages
ALTER TABLE products ADD COLUMN faq_en TEXT;
ALTER TABLE products ADD COLUMN faq_th TEXT;
