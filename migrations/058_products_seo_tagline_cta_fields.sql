-- Separate SEO, product-page tagline, and CTA labels from card benefit copy.
-- Super Admin can now manage these values via D1 without hardcoding.

ALTER TABLE products ADD COLUMN seo_title_en TEXT;
ALTER TABLE products ADD COLUMN seo_title_th TEXT;
ALTER TABLE products ADD COLUMN seo_meta_description_en TEXT;
ALTER TABLE products ADD COLUMN seo_meta_description_th TEXT;

ALTER TABLE products ADD COLUMN product_tagline_en TEXT;
ALTER TABLE products ADD COLUMN product_tagline_th TEXT;

ALTER TABLE products ADD COLUMN cta_primary_en TEXT;
ALTER TABLE products ADD COLUMN cta_primary_th TEXT;
ALTER TABLE products ADD COLUMN cta_custom_en TEXT;
ALTER TABLE products ADD COLUMN cta_custom_th TEXT;
ALTER TABLE products ADD COLUMN cta_size_help_en TEXT;
ALTER TABLE products ADD COLUMN cta_size_help_th TEXT;
