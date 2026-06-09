ALTER TABLE blog_posts ADD COLUMN categories_json TEXT DEFAULT '[]';

UPDATE blog_posts
SET categories_json = CASE
  WHEN category IS NULL OR TRIM(category) = '' THEN '[]'
  ELSE json_array(category)
END
WHERE categories_json IS NULL OR TRIM(categories_json) = '';
