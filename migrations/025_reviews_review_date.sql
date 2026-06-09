ALTER TABLE reviews ADD COLUMN review_date TEXT DEFAULT (date('now'));

UPDATE reviews
SET review_date = COALESCE(NULLIF(substr(created_at, 1, 10), ''), date('now'))
WHERE review_date IS NULL OR TRIM(review_date) = '';

CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date DESC);
