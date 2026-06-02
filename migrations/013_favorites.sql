-- MildMate Migration 013
-- Adds authenticated user favorites (wishlist) storage

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_email ON favorites(email);
