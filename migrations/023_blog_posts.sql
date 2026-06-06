-- MildMate Migration 023
-- Blog posts table for admin CMS
-- Bilingual EN/TH, WYSIWYG body, featured image, live D1 (no static rebuild)

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_th TEXT DEFAULT '',
  meta_description_en TEXT DEFAULT '',
  meta_description_th TEXT DEFAULT '',
  body_en TEXT DEFAULT '',
  body_th TEXT DEFAULT '',
  featured_image TEXT DEFAULT '',
  featured_image_alt_en TEXT DEFAULT '',
  featured_image_alt_th TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  author TEXT DEFAULT 'MildMate Team',
  read_time_en TEXT DEFAULT '5 min read',
  read_time_th TEXT DEFAULT '5 นาที อ่าน',
  status TEXT DEFAULT 'draft',   -- draft | published
  is_featured INTEGER DEFAULT 0,
  th_redirect_path TEXT DEFAULT '',
  related_products_json TEXT DEFAULT '[]', -- JSON array of {slug, image, alt, tags, title, price}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_featured ON blog_posts(is_featured) WHERE is_featured = 1;
CREATE INDEX IF NOT EXISTS idx_blog_updated ON blog_posts(updated_at DESC);
