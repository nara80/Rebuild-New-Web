-- Migration 024: Customer Reviews
-- Unified reviews from multiple platforms (Etsy, eBay, Shopee, Lazada, Amazon, TikTok, Website, LineOA, WhatsApp, FB, IG)
-- Displayed on homepage carousel, product pages by product_type, and /reviews/ page

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_country TEXT DEFAULT '',
  review_text TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK(rating >= 1 AND rating <= 5),
  product_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_reviews_product_type ON reviews(product_type);
CREATE INDEX idx_reviews_platform ON reviews(platform);
CREATE INDEX idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
