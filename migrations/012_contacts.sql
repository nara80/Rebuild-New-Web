-- MildMate Migration 012
-- Creates unified contacts table (Option A: single source of truth)
-- Replaces fragmented email storage across subscribers/orders/custom_quotes

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  sources TEXT DEFAULT '',           -- comma-separated: subscribe,checkout,quote,clerk,contact
  is_subscribed INTEGER DEFAULT 0,   -- 1 = opted into newsletter
  language TEXT DEFAULT 'en',
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT                       -- JSON: {last_order_id, clerk_user_id, address}
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_subscribed ON contacts(is_subscribed);

-- Backfill from subscribers (newsletter signups)
INSERT OR IGNORE INTO contacts (email, sources, is_subscribed, language, first_seen, last_seen)
SELECT email, 'subscribe', 1, COALESCE(language, 'en'), created_at, created_at
FROM subscribers;

-- Backfill from orders (checkout emails — mark as subscribed only if also in subscribers)
INSERT INTO contacts (email, name, phone, sources, is_subscribed, first_seen, last_seen, metadata)
SELECT 
  o.email, 
  MAX(o.customer_name), 
  MAX(o.phone), 
  'checkout', 
  CASE WHEN EXISTS(SELECT 1 FROM subscribers s WHERE s.email = o.email) THEN 1 ELSE 0 END,
  MIN(o.created_at), 
  MAX(o.created_at),
  NULL
FROM orders o
WHERE o.email NOT IN (SELECT email FROM contacts)
GROUP BY o.email;

-- Backfill from custom_quotes (quote requests auto-subscribe)
INSERT INTO contacts (email, name, phone, sources, is_subscribed, first_seen, last_seen)
SELECT 
  email, 
  MAX(customer_name), 
  MAX(telephone), 
  'quote', 
  1,
  MIN(created_at), 
  MAX(created_at)
FROM custom_quotes
WHERE email NOT IN (SELECT email FROM contacts)
GROUP BY email;

-- Merge sources for contacts that appear in multiple tables
UPDATE contacts SET
  sources = (SELECT GROUP_CONCAT(DISTINCT src) FROM (
    SELECT 'subscribe' AS src FROM subscribers WHERE subscribers.email = contacts.email
    UNION SELECT 'checkout' FROM orders WHERE orders.email = contacts.email
    UNION SELECT 'quote' FROM custom_quotes WHERE custom_quotes.email = contacts.email
  )),
  is_subscribed = CASE WHEN EXISTS(SELECT 1 FROM subscribers s WHERE s.email = contacts.email) THEN 1 ELSE contacts.is_subscribed END;
