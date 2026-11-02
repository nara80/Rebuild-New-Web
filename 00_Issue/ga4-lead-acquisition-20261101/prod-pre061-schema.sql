PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_th TEXT,
  description_en TEXT,
  description_th TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  fabric_options TEXT DEFAULT 'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  base_price_usd REAL NOT NULL DEFAULT 0,
  base_price_thb REAL NOT NULL DEFAULT 0,
  price_per_cm2_usd REAL DEFAULT 0,
  price_per_cm2_thb REAL DEFAULT 0,
  is_custom INTEGER DEFAULT 1,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, tags TEXT DEFAULT '', youtube_url TEXT DEFAULT '', images TEXT DEFAULT '[]', product_type TEXT, niches TEXT, card_benefit_en TEXT DEFAULT '', card_benefit_th TEXT DEFAULT '', faq_en TEXT, faq_th TEXT, seo_title_en TEXT, seo_title_th TEXT, seo_meta_description_en TEXT, seo_meta_description_th TEXT, product_tagline_en TEXT, product_tagline_th TEXT, cta_primary_en TEXT, cta_primary_th TEXT, cta_custom_en TEXT, cta_custom_th TEXT, cta_size_help_en TEXT, cta_size_help_th TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  shipping_address TEXT,
  product_slug TEXT NOT NULL,
  product_title_en TEXT,
  fabric TEXT,
  color TEXT,
  width_cm REAL,
  length_cm REAL,
  depth_cm REAL,
  width_in REAL,
  length_in REAL,
  depth_in REAL,
  custom_notes TEXT,
  price_usd REAL,
  price_thb REAL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, discount_code TEXT, carrier_code TEXT, tracking_number TEXT, tracking_url TEXT, shipping_status TEXT, shipped_at DATETIME, customer_note_type TEXT, customer_note TEXT, is_archived INTEGER NOT NULL DEFAULT 0, quote_id TEXT);
CREATE TABLE abandoned_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  customer_name TEXT,
  cart_json TEXT NOT NULL,
  recovered INTEGER DEFAULT 0,
  recovery_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, recovery_stage INTEGER DEFAULT 0, discount_code TEXT);
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',
  language TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE discount_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,          
  status TEXT DEFAULT 'issued',       
  address_hash TEXT,                  
  order_id INTEGER,                   
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at DATETIME, expires_at DATETIME, source TEXT DEFAULT 'subscribe', discount_pct INTEGER DEFAULT 15,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,       
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE pricing_params (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL,
  label TEXT,
  category TEXT NOT NULL,       
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE diy_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_slug TEXT NOT NULL,
  shape_code TEXT,              
  size_key TEXT,                
  price_thb INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  label TEXT,                   
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE exchange_rates (
  currency TEXT PRIMARY KEY,     
  rate_per_thb REAL NOT NULL,   
  label TEXT,                   
  symbol TEXT,                  
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',       
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  sources TEXT DEFAULT '',           
  is_subscribed INTEGER DEFAULT 0,   
  language TEXT DEFAULT 'en',
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT                       
);
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE shipping_rates (
  country_code TEXT PRIMARY KEY,              
  country_name TEXT NOT NULL,
  first_item_usd REAL NOT NULL DEFAULT 0,
  additional_item_usd REAL NOT NULL DEFAULT 0,
  first_item_thb REAL NOT NULL DEFAULT 0,
  additional_item_thb REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT (datetime('now'))
, tier1_first_thb INTEGER NOT NULL DEFAULT 0, tier1_add_thb INTEGER NOT NULL DEFAULT 0, tier2_first_thb INTEGER NOT NULL DEFAULT 0, tier2_add_thb INTEGER NOT NULL DEFAULT 0, tier3_first_thb INTEGER NOT NULL DEFAULT 0, tier3_add_thb INTEGER NOT NULL DEFAULT 0);
CREATE TABLE countries_master (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  phone_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_fallback INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE recovery_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE thankyou_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  email TEXT NOT NULL,
  discount_code TEXT NOT NULL,
  discount_pct INTEGER NOT NULL,
  send_after TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
, sent_at DATETIME, last_error TEXT);
CREATE TABLE promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           
  discount_pct INTEGER NOT NULL,       
  order_minimum_usd INTEGER DEFAULT 0, 
  duration_days INTEGER NOT NULL,      
  max_uses INTEGER DEFAULT 1,          
  use_count INTEGER DEFAULT 0,         
  per_email_limit INTEGER DEFAULT 1,   
  is_active INTEGER DEFAULT 1,          
  created_by TEXT,                      
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME                  
, free_shipping INTEGER NOT NULL DEFAULT 0);
CREATE TABLE promo_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  order_id INTEGER,
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE CASCADE
);
CREATE TABLE blog_posts (
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
  status TEXT DEFAULT 'draft',   
  is_featured INTEGER DEFAULT 0,
  th_redirect_path TEXT DEFAULT '',
  related_products_json TEXT DEFAULT '[]', 
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, categories_json TEXT DEFAULT '[]', youtube_url TEXT DEFAULT '');
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
, review_date TEXT DEFAULT (date('now')));
CREATE TABLE site_templates (
  template_key TEXT PRIMARY KEY,
  template_html TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE shipping_product_tiers (
  product_slug TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK(tier IN (1,2,3)),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE shipping_add_rates (
  tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
  add_thb INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE custom_quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, email TEXT NOT NULL, address TEXT, telephone TEXT, product_slug TEXT NOT NULL, dimensions TEXT NOT NULL, fabric TEXT, color TEXT, status TEXT DEFAULT 'pending', quoted_price INTEGER, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, quoted_price_usd INTEGER, free_shipping INTEGER DEFAULT 0);
CREATE TABLE shipping_service_rates (
          country_code TEXT NOT NULL,
          service_level TEXT NOT NULL CHECK(service_level IN ('standard','express')),
          country_name TEXT NOT NULL,
          tier1_first_thb INTEGER NOT NULL DEFAULT 0,
          tier2_first_thb INTEGER NOT NULL DEFAULT 0,
          tier3_first_thb INTEGER NOT NULL DEFAULT 0,
          eta_min_days INTEGER NOT NULL DEFAULT 3,
          eta_max_days INTEGER NOT NULL DEFAULT 7,
          eta_note TEXT DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now')),
          PRIMARY KEY (country_code, service_level)
        );
CREATE TABLE marketing_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discount_pct INTEGER NOT NULL,
      product_slugs TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE fabric_color_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fabric TEXT NOT NULL,
  color  TEXT NOT NULL,
  in_stock INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fabric, color)
);
CREATE TABLE boat_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  shape_code TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, model_year INTEGER, sale_price_usd REAL, model_label TEXT, schematic_key TEXT, schematic_url TEXT);
CREATE TABLE product_niches (product_id INTEGER NOT NULL, niche_type TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (product_id, niche_type));
CREATE TABLE product_collections (product_id INTEGER NOT NULL, collection_type TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (product_id, collection_type));
CREATE TABLE sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_system TEXT NOT NULL,
  source_order_id TEXT NOT NULL,
  notion_page_id TEXT,
  order_date TEXT,
  channel TEXT,
  currency TEXT,
  order_total REAL,
  status TEXT,
  destination_country TEXT,
  mapping_status TEXT,
  source_created_at TEXT,
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_system, source_order_id)
);
CREATE TABLE sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL,
  source_item_key TEXT NOT NULL,
  item_no INTEGER,
  product_id INTEGER,
  quantity REAL,
  raw_item_text TEXT,
  line_revenue REAL,
  revenue_status TEXT NOT NULL,
  mapping_status TEXT,
  item_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(sales_order_id, source_item_key)
);
CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  scenario TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  records_received INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_unchanged INTEGER DEFAULT 0,
  records_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE checkout_session_snapshots (
             stripe_session_id TEXT PRIMARY KEY,
             email TEXT,
             currency TEXT,
             items_json TEXT NOT NULL,
             created_at DATETIME DEFAULT (datetime('now'))
           , attribution_json TEXT, quote_ids_json TEXT);
CREATE TABLE product_mapping_aliases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_system TEXT,
          listing_id TEXT,
          alias_text TEXT NOT NULL,
          alias_norm TEXT NOT NULL,
          product_ids TEXT NOT NULL,
          match_scope TEXT NOT NULL DEFAULT 'alias',
          verified INTEGER NOT NULL DEFAULT 0,
          hit_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE product_mapping_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notion_page_id TEXT,
          source_order_id TEXT,
          source_system TEXT,
          raw_product_text TEXT,
          previous_product_ids TEXT,
          resolved_product_ids TEXT,
          mapping_method TEXT,
          confidence REAL,
          result_status TEXT,
          dry_run INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE marketing_sync_state (name TEXT PRIMARY KEY, cursor TEXT, last_run_at TEXT, last_success_at TEXT, last_status TEXT, last_processed INTEGER DEFAULT 0, last_synced INTEGER DEFAULT 0, consecutive_failures INTEGER DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE marketing_sync_lock (name TEXT PRIMARY KEY, locked_until TEXT, run_id TEXT, updated_at TEXT);
CREATE TABLE gsc_search_daily ( id INTEGER PRIMARY KEY AUTOINCREMENT, report_date TEXT NOT NULL, query_text TEXT NOT NULL, query_norm TEXT NOT NULL, page_url TEXT NOT NULL, page_path TEXT NOT NULL, country TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', search_type TEXT NOT NULL DEFAULT 'web', search_appearance TEXT NOT NULL DEFAULT '', clicks INTEGER NOT NULL DEFAULT 0, impressions INTEGER NOT NULL DEFAULT 0, ctr REAL, position REAL, product_id INTEGER, mapping_scope TEXT NOT NULL DEFAULT 'non_product', source_updated_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (product_id) REFERENCES products(id), UNIQUE(report_date, query_norm, page_url, country, device, search_type, search_appearance) );
CREATE TABLE oauth_token_state (
  provider TEXT PRIMARY KEY,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE etsy_listing_master (
  listing_id TEXT PRIMARY KEY,
  shop_id TEXT,
  shop_name TEXT,
  listing_title TEXT NOT NULL DEFAULT '',
  listing_state TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  listing_url TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  price REAL,
  quantity_available INTEGER,
  views_total INTEGER,
  favorites_total INTEGER,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE etsy_listing_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  listing_title TEXT NOT NULL DEFAULT '',
  listing_state TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT '',
  visits INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  favorites INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  transactions INTEGER NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  revenue REAL,
  revenue_thb REAL,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES etsy_listing_master(listing_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, listing_id, currency)
);
CREATE TABLE cost_model_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  production_cost_thb REAL NOT NULL,
  cost_source TEXT NOT NULL DEFAULT 'formula',     -- 'verified' | 'formula'
  is_estimate INTEGER NOT NULL DEFAULT 1,          -- verified rows: 0 (EXACT/VERIFIED)
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, modeled_price_thb REAL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(product_id, effective_from, cost_source)
);
CREATE TABLE cost_model_channel_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,                           -- lower(trim(source_system))
  marketplace_fee_pct REAL NOT NULL DEFAULT 0,
  payment_fee_pct REAL NOT NULL DEFAULT 0,
  payment_fee_fixed_thb REAL NOT NULL DEFAULT 0,
  other_fee_thb_per_order REAL NOT NULL DEFAULT 0,
  is_estimate INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, effective_from)
);
CREATE TABLE cost_model_shipping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,                           -- lower(trim(source_system))
  avg_shipping_cost_thb REAL NOT NULL,
  is_estimate INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, effective_from)
);
CREATE TABLE google_ads_campaign_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  ad_group_id TEXT NOT NULL DEFAULT '',
  ad_group_name TEXT NOT NULL DEFAULT '',
  channel_type TEXT NOT NULL DEFAULT '',
  network TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversion_value REAL NOT NULL DEFAULT 0,
  all_conversions REAL,
  all_conversions_value REAL,
  product_id INTEGER,
  mapping_scope TEXT NOT NULL DEFAULT 'unmapped',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, customer_id, campaign_id, ad_group_id, network, device, currency)
);
CREATE TABLE opportunity_score_models (
  model_version TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE opportunity_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score_date TEXT NOT NULL,
  score_model_version TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  score REAL,
  rank INTEGER,
  tier TEXT NOT NULL,
  confidence REAL,
  components_json TEXT NOT NULL DEFAULT '{}',
  available_weight REAL NOT NULL DEFAULT 0,
  missing_components TEXT NOT NULL DEFAULT '',
  reasons TEXT NOT NULL DEFAULT '',
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(score_date, score_model_version, product_id, channel)
);
CREATE TABLE IF NOT EXISTS "ga4_funnel_daily" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  property_id TEXT NOT NULL DEFAULT '366290587',
  property_scope TEXT NOT NULL DEFAULT 'website',
  landing_page_path TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  begin_checkout INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_revenue REAL,
  product_id INTEGER,
  listing_id TEXT,
  mapping_scope TEXT NOT NULL DEFAULT 'non_product',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(report_date, property_id, landing_page_path, page_path, source, medium, campaign, country, device)
);
CREATE TABLE stripe_webhook_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, stripe_session_id TEXT, processing_token TEXT, processed_at DATETIME, process_result TEXT, last_error TEXT, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')));
CREATE TABLE stripe_order_fulfillment_lines (line_key TEXT PRIMARY KEY, stripe_session_id TEXT NOT NULL, stripe_event_id TEXT, line_index INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now')));
CREATE TABLE admin_accounts (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'Admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT
    );
CREATE TABLE quote_followup_events (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, email TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent', error TEXT, sent_at DATETIME, run_source TEXT DEFAULT 'cron-worker', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE quote_acquisition_attribution (
  quote_id TEXT PRIMARY KEY,
  email TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  first_touch_json TEXT,
  quote_session_json TEXT,
  checkout_session_json TEXT,
  consent_state_json TEXT,
  quote_session_captured_at DATETIME,
  checkout_session_captured_at DATETIME,
  checkout_stripe_session_id TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_abandoned_email ON abandoned_carts(email);
CREATE INDEX idx_abandoned_recovered ON abandoned_carts(recovered, created_at);
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE UNIQUE INDEX idx_discount_active_address
ON discount_claims(address_hash, status)
WHERE status = 'issued' AND address_hash IS NOT NULL;
CREATE INDEX idx_discount_email ON discount_claims(email);
CREATE INDEX idx_discount_code ON discount_claims(code);
CREATE INDEX idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX idx_rate_limits_created ON rate_limits(created_at);
CREATE INDEX idx_diy_product ON diy_prices(product_slug, shape_code);
CREATE INDEX idx_addresses_email ON customer_addresses(email);
CREATE INDEX idx_addresses_default ON customer_addresses(email, is_default);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_subscribed ON contacts(is_subscribed);
CREATE INDEX idx_favorites_user_created ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_product ON favorites(product_id);
CREATE INDEX idx_favorites_email ON favorites(email);
CREATE INDEX idx_thankyou_queue_pending ON thankyou_queue(sent, send_after);
CREATE UNIQUE INDEX idx_promo_code ON promo_codes(code);
CREATE INDEX idx_promo_redemptions_email ON promo_redemptions(promo_id, email);
CREATE INDEX idx_promo_redemptions_order ON promo_redemptions(order_id);
CREATE UNIQUE INDEX idx_blog_slug ON blog_posts(slug);
CREATE INDEX idx_blog_status ON blog_posts(status);
CREATE INDEX idx_blog_category ON blog_posts(category);
CREATE INDEX idx_blog_featured ON blog_posts(is_featured) WHERE is_featured = 1;
CREATE INDEX idx_blog_updated ON blog_posts(updated_at DESC);
CREATE INDEX idx_reviews_product_type ON reviews(product_type);
CREATE INDEX idx_reviews_platform ON reviews(platform);
CREATE INDEX idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
CREATE INDEX idx_reviews_review_date ON reviews(review_date DESC);
CREATE INDEX idx_quotes_email ON custom_quotes(email);
CREATE INDEX idx_quotes_status ON custom_quotes(status);
CREATE INDEX idx_quotes_id ON custom_quotes(quote_id);
CREATE INDEX idx_boat_models_active ON boat_models(is_active);
CREATE INDEX idx_boat_models_shape ON boat_models(shape_code);
CREATE INDEX idx_boat_models_name_year ON boat_models(model_name, model_year);
CREATE INDEX idx_boat_models_label ON boat_models(model_label);
CREATE INDEX idx_sales_orders_order_date
  ON sales_orders(order_date);
CREATE INDEX idx_sales_orders_channel
  ON sales_orders(channel);
CREATE INDEX idx_sales_orders_status
  ON sales_orders(status);
CREATE INDEX idx_sales_orders_notion_page
  ON sales_orders(notion_page_id);
CREATE INDEX idx_sales_order_items_product
  ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_order
  ON sales_order_items(sales_order_id);
CREATE UNIQUE INDEX idx_product_mapping_aliases_key
          ON product_mapping_aliases (COALESCE(source_system, ''), COALESCE(listing_id, ''), alias_norm);
CREATE INDEX idx_product_mapping_aliases_listing ON product_mapping_aliases(listing_id);
CREATE INDEX idx_product_mapping_events_order ON product_mapping_events(source_order_id);
CREATE INDEX idx_product_mapping_events_page ON product_mapping_events(notion_page_id);
CREATE INDEX idx_gsc_search_daily_date ON gsc_search_daily(report_date);
CREATE INDEX idx_gsc_search_daily_product_date ON gsc_search_daily(product_id, report_date);
CREATE INDEX idx_gsc_search_daily_page_date ON gsc_search_daily(page_path, report_date);
CREATE INDEX idx_gsc_search_daily_query_date ON gsc_search_daily(query_norm, report_date);
CREATE INDEX idx_etsy_listing_master_product ON etsy_listing_master(product_id);
CREATE INDEX idx_etsy_listing_master_active ON etsy_listing_master(is_active, listing_state);
CREATE INDEX idx_etsy_listing_daily_date ON etsy_listing_daily(report_date);
CREATE INDEX idx_etsy_listing_daily_listing_date ON etsy_listing_daily(listing_id, report_date);
CREATE INDEX idx_etsy_listing_daily_product_date ON etsy_listing_daily(product_id, report_date);
CREATE INDEX idx_cost_model_products_lookup
  ON cost_model_products(product_id, effective_from);
CREATE INDEX idx_cost_model_channel_fees_lookup
  ON cost_model_channel_fees(channel, effective_from);
CREATE INDEX idx_cost_model_shipping_lookup
  ON cost_model_shipping(channel, effective_from);
CREATE INDEX idx_google_ads_daily_date
  ON google_ads_campaign_daily(report_date);
CREATE INDEX idx_google_ads_daily_campaign_date
  ON google_ads_campaign_daily(campaign_id, ad_group_id, report_date);
CREATE INDEX idx_google_ads_daily_product_date
  ON google_ads_campaign_daily(product_id, report_date);
CREATE INDEX idx_opportunity_scores_latest
ON opportunity_scores(score_model_version, score_date DESC, channel, rank);
CREATE INDEX idx_opportunity_scores_product
ON opportunity_scores(product_id, score_date DESC);
CREATE INDEX idx_ga4_funnel_daily_date ON ga4_funnel_daily(report_date);
CREATE INDEX idx_ga4_funnel_daily_product_date ON ga4_funnel_daily(product_id, report_date);
CREATE INDEX idx_ga4_funnel_daily_landing_date ON ga4_funnel_daily(landing_page_path, report_date);
CREATE INDEX idx_ga4_funnel_daily_page_date ON ga4_funnel_daily(page_path, report_date);
CREATE INDEX idx_ga4_funnel_daily_scope_date ON ga4_funnel_daily(property_scope, report_date);
CREATE INDEX idx_ga4_funnel_daily_listing_date ON ga4_funnel_daily(listing_id, report_date);
CREATE INDEX idx_stripe_webhook_events_session ON stripe_webhook_events(stripe_session_id);
CREATE INDEX idx_stripe_fulfillment_session ON stripe_order_fulfillment_lines(stripe_session_id);
CREATE INDEX idx_orders_quote_id ON orders(quote_id);
CREATE UNIQUE INDEX idx_quote_followup_unique_stage ON quote_followup_events(quote_id, stage);
CREATE INDEX idx_quote_followup_status_sent ON quote_followup_events(status, sent_at);
CREATE INDEX idx_quote_followup_email_created ON quote_followup_events(email, created_at);
CREATE INDEX idx_quote_acquisition_attr_email
  ON quote_acquisition_attribution(email);
CREATE INDEX idx_quote_acquisition_attr_checkout_session
  ON quote_acquisition_attribution(checkout_stripe_session_id);
CREATE VIEW analysis_commercial_orders AS
SELECT
  o.id,
  o.source_system,
  o.source_order_id,
  lower(trim(o.source_system)) AS channel_norm,
  substr(o.order_date, 1, 10)  AS order_day,
  o.order_date,
  o.currency,
  o.order_total,
  lower(o.status)              AS status,
  o.destination_country,
  o.mapping_status             AS raw_mapping_status,
  o.created_at,
  o.updated_at
FROM sales_orders o
WHERE lower(o.status) IN ('paid','processing','shipped','completed')
  AND o.source_order_id NOT LIKE 'TEST-%';
CREATE VIEW analysis_active_items AS
SELECT
  i.id,
  i.sales_order_id,
  i.source_item_key,
  i.item_no,
  i.product_id,
  i.quantity,
  i.raw_item_text,
  i.line_revenue,
  i.revenue_status,
  i.mapping_status AS raw_mapping_status,
  co.channel_norm,
  co.order_day,
  co.currency,
  co.order_total
FROM sales_order_items i
JOIN analysis_commercial_orders co ON co.id = i.sales_order_id
WHERE i.item_status = 'active';
CREATE VIEW analysis_order_mapping AS
SELECT
  co.id AS sales_order_id,
  COUNT(ai.id)                   AS active_items,
  SUM(ai.product_id IS NOT NULL) AS mapped_items,
  CASE
    WHEN COUNT(ai.id) = 0 THEN 'Itemless'
    WHEN SUM(ai.product_id IS NULL) = 0 THEN 'Mapped'
    WHEN SUM(ai.product_id IS NOT NULL) > 0 THEN 'Partial'
    ELSE 'Unmapped'
  END AS derived_mapping_status
FROM analysis_commercial_orders co
LEFT JOIN analysis_active_items ai ON ai.sales_order_id = co.id
GROUP BY co.id;
CREATE VIEW analysis_sales_daily AS
SELECT
  co.order_day,
  co.channel_norm,
  co.currency,
  COUNT(*)                              AS orders,
  SUM(co.order_total)                   AS order_revenue,
  SUM(co.order_total) * 1.0 / COUNT(*)  AS aov,
  SUM(COALESCE(ia.units, 0))            AS units,
  SUM(CASE WHEN om.derived_mapping_status = 'Mapped' THEN 1 ELSE 0 END) AS mapped_orders,
  SUM(COALESCE(ia.exact_items, 0))        AS exact_items,
  SUM(COALESCE(ia.unallocated_items, 0))  AS unallocated_items
FROM analysis_commercial_orders co
LEFT JOIN (
  SELECT
    sales_order_id,
    SUM(quantity)                        AS units,
    SUM(revenue_status = 'EXACT')        AS exact_items,
    SUM(revenue_status = 'UNALLOCATED')  AS unallocated_items
  FROM analysis_active_items
  GROUP BY sales_order_id
) ia ON ia.sales_order_id = co.id
LEFT JOIN analysis_order_mapping om ON om.sales_order_id = co.id
WHERE co.order_day IS NOT NULL AND length(co.order_day) = 10
GROUP BY co.order_day, co.channel_norm, co.currency;
CREATE VIEW analysis_product_participation AS
SELECT
  ai.product_id,
  COALESCE(p.title_en, '(unmapped)') AS product_title,
  p.slug                             AS product_slug,
  COUNT(DISTINCT ai.sales_order_id)  AS orders_containing_product,
  SUM(ai.quantity)                   AS quantity,
  SUM(CASE WHEN ai.revenue_status = 'EXACT' THEN ai.line_revenue END) AS exact_revenue,
  SUM(ai.revenue_status = 'EXACT')   AS exact_items,
  COUNT(*)                           AS total_items,
  COUNT(DISTINCT ai.channel_norm)    AS channel_count
FROM analysis_active_items ai
LEFT JOIN products p ON p.id = ai.product_id
GROUP BY ai.product_id, p.title_en, p.slug;
CREATE VIEW analysis_product_channel AS
SELECT
  ai.product_id,
  ai.channel_norm,
  COUNT(DISTINCT ai.sales_order_id) AS orders,
  SUM(ai.quantity)                  AS units,
  SUM(CASE WHEN ai.revenue_status = 'EXACT' THEN ai.line_revenue END) AS exact_revenue
FROM analysis_active_items ai
GROUP BY ai.product_id, ai.channel_norm;
CREATE VIEW analysis_sales_28d AS
SELECT
  base.product_id,
  COALESCE(cur.orders, 0)        AS orders_28d,
  COALESCE(cur.units, 0)         AS units_28d,
  cur.exact_revenue              AS exact_revenue_28d,
  COALESCE(prev.orders, 0)       AS orders_prev_28d,
  CASE WHEN COALESCE(prev.orders, 0) > 0
       THEN (COALESCE(cur.orders, 0) - prev.orders) * 1.0 / prev.orders
  END AS growth_vs_previous
FROM (
  SELECT DISTINCT product_id FROM analysis_active_items
  WHERE order_day >= date('now', '-56 day')
) base
LEFT JOIN (
  SELECT product_id,
         COUNT(DISTINCT sales_order_id) AS orders,
         SUM(quantity)                  AS units,
         SUM(CASE WHEN revenue_status = 'EXACT' THEN line_revenue END) AS exact_revenue
  FROM analysis_active_items
  WHERE order_day >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id IS base.product_id
LEFT JOIN (
  SELECT product_id,
         COUNT(DISTINCT sales_order_id) AS orders
  FROM analysis_active_items
  WHERE order_day >= date('now', '-56 day')
    AND order_day <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id IS base.product_id;
CREATE VIEW analysis_sales_90d AS
SELECT
  base.product_id,
  COALESCE(cur.orders, 0)        AS orders_90d,
  COALESCE(cur.units, 0)         AS units_90d,
  cur.exact_revenue              AS exact_revenue_90d,
  COALESCE(prev.orders, 0)       AS orders_prev_90d,
  CASE WHEN COALESCE(prev.orders, 0) > 0
       THEN (COALESCE(cur.orders, 0) - prev.orders) * 1.0 / prev.orders
  END AS growth_vs_previous
FROM (
  SELECT DISTINCT product_id FROM analysis_active_items
  WHERE order_day >= date('now', '-180 day')
) base
LEFT JOIN (
  SELECT product_id,
         COUNT(DISTINCT sales_order_id) AS orders,
         SUM(quantity)                  AS units,
         SUM(CASE WHEN revenue_status = 'EXACT' THEN line_revenue END) AS exact_revenue
  FROM analysis_active_items
  WHERE order_day >= date('now', '-90 day')
  GROUP BY product_id
) cur ON cur.product_id IS base.product_id
LEFT JOIN (
  SELECT product_id,
         COUNT(DISTINCT sales_order_id) AS orders
  FROM analysis_active_items
  WHERE order_day >= date('now', '-180 day')
    AND order_day <  date('now', '-90 day')
  GROUP BY product_id
) prev ON prev.product_id IS base.product_id;
CREATE VIEW analysis_product_copurchase AS
SELECT
  a.product_id AS product_a,
  b.product_id AS product_b,
  COUNT(DISTINCT a.sales_order_id) AS co_orders
FROM (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) a
JOIN (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) b
  ON a.sales_order_id = b.sales_order_id AND a.product_id < b.product_id
GROUP BY a.product_id, b.product_id;
CREATE VIEW analysis_data_quality AS
SELECT
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs WHERE status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1)  AS last_sync_status,
  (SELECT COUNT(*) FROM sync_runs
    WHERE status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day'))                 AS sync_errors_7d,
  (SELECT COUNT(*) FROM analysis_commercial_orders)                                       AS commercial_orders,
  (SELECT COUNT(*) FROM sales_orders WHERE source_order_id LIKE 'TEST-%')                 AS test_orders,
  (SELECT COUNT(*) FROM sales_orders
    WHERE source_order_id NOT LIKE 'TEST-%'
      AND lower(COALESCE(status, '')) IN ('pending', 'cancelled', 'refunded', 'archived')) AS excluded_status_orders,
  (SELECT COUNT(*) FROM sales_orders
    WHERE status IS NULL OR lower(status) NOT IN
      ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded', 'archived')) AS unknown_status_orders,
  (SELECT COUNT(*) FROM analysis_order_mapping WHERE derived_mapping_status = 'Mapped')   AS mapped_orders,
  (SELECT COUNT(*) FROM analysis_order_mapping WHERE derived_mapping_status = 'Partial')  AS partial_orders,
  (SELECT COUNT(*) FROM analysis_order_mapping WHERE derived_mapping_status = 'Unmapped') AS unmapped_orders,
  (SELECT COUNT(*) FROM analysis_order_mapping WHERE derived_mapping_status = 'Itemless') AS itemless_orders,
  (SELECT COUNT(*) FROM analysis_active_items)                                            AS active_items,
  (SELECT COUNT(*) FROM analysis_active_items WHERE product_id IS NULL)                   AS missing_product_id_items,
  (SELECT COUNT(*) FROM analysis_active_items WHERE revenue_status = 'EXACT')             AS exact_items,
  (SELECT COUNT(*) FROM analysis_active_items WHERE revenue_status = 'UNALLOCATED')       AS unallocated_items,
  (SELECT COUNT(*) FROM analysis_commercial_orders
    WHERE order_day IS NULL OR length(order_day) <> 10)                                   AS orders_missing_date,
  (SELECT COUNT(*) FROM analysis_active_items ai
    LEFT JOIN products p ON p.id = ai.product_id
    WHERE ai.product_id IS NOT NULL AND p.id IS NULL)                                     AS invalid_product_refs,
  (SELECT COUNT(DISTINCT source_system) FROM sales_orders
    WHERE lower(trim(source_system)) NOT IN
      ('shopee', 'lazada', 'tiktok', 'line', 'whatsapp', 'etsy', 'ebay', 'facebook', 'website', 'manual')) AS unknown_source_labels;
CREATE VIEW analysis_gsc_daily AS SELECT g.report_date, COUNT(*) AS rows_count, COUNT(DISTINCT g.query_norm) AS queries, COUNT(DISTINCT g.page_path) AS pages, SUM(g.clicks) AS clicks, SUM(g.impressions) AS impressions, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2) END AS ctr_pct, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2) END AS avg_position, SUM(CASE WHEN g.product_id IS NOT NULL THEN g.clicks ELSE 0 END) AS mapped_clicks, SUM(CASE WHEN g.product_id IS NOT NULL THEN g.impressions ELSE 0 END) AS mapped_impressions FROM gsc_search_daily g WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10 GROUP BY g.report_date;
CREATE VIEW analysis_gsc_page_daily AS SELECT g.report_date, g.page_path, g.product_id, COUNT(DISTINCT g.query_norm) AS queries, SUM(g.clicks) AS clicks, SUM(g.impressions) AS impressions, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2) END AS ctr_pct, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2) END AS avg_position FROM gsc_search_daily g WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10 GROUP BY g.report_date, g.page_path, g.product_id;
CREATE VIEW analysis_gsc_product_daily AS SELECT g.report_date, g.product_id, p.slug AS product_slug, p.title_en AS product_title, COUNT(DISTINCT g.query_norm) AS queries, COUNT(DISTINCT g.page_path) AS landing_pages, SUM(g.clicks) AS clicks, SUM(g.impressions) AS impressions, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2) END AS ctr_pct, CASE WHEN SUM(g.impressions) > 0 THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2) END AS avg_position FROM gsc_search_daily g JOIN products p ON p.id = g.product_id WHERE g.product_id IS NOT NULL AND g.report_date IS NOT NULL AND length(g.report_date) = 10 GROUP BY g.report_date, g.product_id, p.slug, p.title_en;
CREATE VIEW analysis_gsc_product_28d AS SELECT base.product_id, p.slug AS product_slug, p.title_en AS product_title, COALESCE(cur.clicks, 0) AS clicks_28d, COALESCE(cur.impressions, 0) AS impressions_28d, cur.ctr_pct AS ctr_28d, cur.avg_position AS avg_position_28d, COALESCE(prev.clicks, 0) AS clicks_prev_28d, COALESCE(prev.impressions, 0) AS impressions_prev_28d, prev.ctr_pct AS ctr_prev_28d, prev.avg_position AS avg_position_prev_28d, CASE WHEN COALESCE(prev.clicks, 0) > 0 THEN ROUND((COALESCE(cur.clicks, 0) - prev.clicks) * 100.0 / prev.clicks, 2) END AS clicks_growth_pct, CASE WHEN COALESCE(prev.impressions, 0) > 0 THEN ROUND((COALESCE(cur.impressions, 0) - prev.impressions) * 100.0 / prev.impressions, 2) END AS impressions_growth_pct FROM ( SELECT DISTINCT product_id FROM gsc_search_daily WHERE product_id IS NOT NULL AND report_date >= date('now', '-56 day') ) base JOIN products p ON p.id = base.product_id LEFT JOIN ( SELECT product_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions, CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks) * 100.0 / SUM(impressions), 2) END AS ctr_pct, CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(COALESCE(position, 0) * impressions) * 1.0 / SUM(impressions), 2) END AS avg_position FROM gsc_search_daily WHERE product_id IS NOT NULL AND report_date >= date('now', '-28 day') GROUP BY product_id ) cur ON cur.product_id = base.product_id LEFT JOIN ( SELECT product_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions, CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks) * 100.0 / SUM(impressions), 2) END AS ctr_pct, CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(COALESCE(position, 0) * impressions) * 1.0 / SUM(impressions), 2) END AS avg_position FROM gsc_search_daily WHERE product_id IS NOT NULL AND report_date >= date('now', '-56 day') AND report_date < date('now', '-28 day') GROUP BY product_id ) prev ON prev.product_id = base.product_id;
CREATE VIEW analysis_gsc_freshness AS SELECT (SELECT MAX(report_date) FROM gsc_search_daily) AS latest_report_date, (SELECT CASE WHEN MAX(report_date) IS NOT NULL THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER) END FROM gsc_search_daily) AS days_since_latest_report, (SELECT COUNT(*) FROM gsc_search_daily) AS total_rows, (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs WHERE source LIKE 'gsc-%' AND status = 'success') AS last_success_sync_at, (SELECT status FROM sync_runs WHERE source LIKE 'gsc-%' ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status, (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs WHERE source LIKE 'gsc-%') AS last_sync_at, (SELECT COUNT(*) FROM sync_runs WHERE source LIKE 'gsc-%' AND status IN ('failed','partial','error') AND COALESCE(finished_at, created_at) >= datetime('now','-7 day')) AS sync_errors_7d;
CREATE VIEW analysis_etsy_daily AS
SELECT
  e.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT e.listing_id) AS listings,
  COUNT(DISTINCT CASE WHEN e.is_active = 1 THEN e.listing_id END) AS active_listings,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue, 0)) AS revenue,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb,
  SUM(CASE WHEN e.product_id IS NOT NULL THEN e.views ELSE 0 END) AS mapped_views,
  SUM(CASE WHEN e.product_id IS NOT NULL THEN e.orders ELSE 0 END) AS mapped_orders
FROM etsy_listing_daily e
WHERE e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY e.report_date;
CREATE VIEW analysis_etsy_listing_daily AS
SELECT
  e.report_date,
  e.listing_id,
  e.listing_title,
  e.listing_state,
  e.is_active,
  e.currency,
  e.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue, 0)) AS revenue,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
FROM etsy_listing_daily e
LEFT JOIN products p ON p.id = e.product_id
WHERE e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY
  e.report_date, e.listing_id, e.listing_title, e.listing_state, e.is_active,
  e.currency, e.product_id, p.slug, p.title_en;
CREATE VIEW analysis_etsy_product_daily AS
SELECT
  e.report_date,
  e.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COUNT(DISTINCT e.listing_id) AS listing_count,
  SUM(e.visits) AS visits,
  SUM(e.views) AS views,
  SUM(e.favorites) AS favorites,
  SUM(e.orders) AS orders,
  SUM(e.transactions) AS transactions,
  SUM(e.units_sold) AS units_sold,
  SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
FROM etsy_listing_daily e
JOIN products p ON p.id = e.product_id
WHERE e.product_id IS NOT NULL
  AND e.report_date IS NOT NULL AND length(e.report_date) = 10
GROUP BY e.report_date, e.product_id, p.slug, p.title_en;
CREATE VIEW analysis_etsy_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.listing_count, 0) AS listing_count_28d,
  COALESCE(cur.views, 0) AS views_28d,
  COALESCE(cur.favorites, 0) AS favorites_28d,
  COALESCE(cur.orders, 0) AS orders_28d,
  COALESCE(cur.transactions, 0) AS transactions_28d,
  COALESCE(cur.units_sold, 0) AS units_sold_28d,
  COALESCE(cur.revenue_thb, 0) AS revenue_thb_28d,
  COALESCE(prev.views, 0) AS views_prev_28d,
  COALESCE(prev.favorites, 0) AS favorites_prev_28d,
  COALESCE(prev.orders, 0) AS orders_prev_28d,
  COALESCE(prev.transactions, 0) AS transactions_prev_28d,
  COALESCE(prev.units_sold, 0) AS units_sold_prev_28d,
  COALESCE(prev.revenue_thb, 0) AS revenue_thb_prev_28d,
  CASE WHEN COALESCE(prev.views, 0) > 0
       THEN ROUND((COALESCE(cur.views, 0) - prev.views) * 100.0 / prev.views, 2)
  END AS views_growth_pct,
  CASE WHEN COALESCE(prev.orders, 0) > 0
       THEN ROUND((COALESCE(cur.orders, 0) - prev.orders) * 100.0 / prev.orders, 2)
  END AS orders_growth_pct,
  CASE WHEN COALESCE(prev.revenue_thb, 0) > 0
       THEN ROUND((COALESCE(cur.revenue_thb, 0) - prev.revenue_thb) * 100.0 / prev.revenue_thb, 2)
  END AS revenue_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    COUNT(DISTINCT listing_id) AS listing_count,
    SUM(views) AS views,
    SUM(favorites) AS favorites,
    SUM(orders) AS orders,
    SUM(transactions) AS transactions,
    SUM(units_sold) AS units_sold,
    SUM(COALESCE(revenue_thb, 0)) AS revenue_thb
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(views) AS views,
    SUM(favorites) AS favorites,
    SUM(orders) AS orders,
    SUM(transactions) AS transactions,
    SUM(units_sold) AS units_sold,
    SUM(COALESCE(revenue_thb, 0)) AS revenue_thb
  FROM etsy_listing_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
    AND report_date < date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;
CREATE VIEW analysis_etsy_listing_status AS
SELECT
  COUNT(*) AS total_listings,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_listings,
  SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_listings,
  SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) AS mapped_listings,
  SUM(CASE WHEN product_id IS NULL THEN 1 ELSE 0 END) AS unmapped_listings,
  MAX(last_seen_at) AS last_listing_sync_at
FROM etsy_listing_master;
CREATE VIEW analysis_etsy_freshness AS
SELECT
  (SELECT MAX(report_date) FROM etsy_listing_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM etsy_listing_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM etsy_listing_daily) AS total_rows,
  (SELECT COUNT(*) FROM etsy_listing_master) AS total_master_listings,
  (SELECT SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM etsy_listing_master) AS active_master_listings,
  (SELECT SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) FROM etsy_listing_master) AS inactive_master_listings,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'etsy-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'etsy-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'etsy-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'etsy-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
CREATE VIEW analysis_profit_items AS
SELECT
  ai.id,
  ai.sales_order_id,
  ai.product_id,
  ai.quantity,
  ai.line_revenue,
  ai.revenue_status,
  ai.channel_norm,
  ai.order_day,
  ai.currency,
  c.production_cost_thb AS unit_cost_thb,
  c.cost_source,
  c.is_estimate AS cost_is_estimate,
  CASE
    WHEN ai.product_id IS NULL THEN 'UNMAPPED'
    WHEN c.id IS NULL THEN 'NO_COST'
    WHEN ai.quantity IS NULL THEN 'NO_QTY'
    ELSE 'COSTED'
  END AS cost_status,
  CASE
    WHEN c.id IS NOT NULL AND ai.quantity IS NOT NULL
    THEN c.production_cost_thb * ai.quantity
  END AS item_production_cost_thb
FROM analysis_active_items ai
LEFT JOIN cost_model_products c ON c.id = (
  SELECT c2.id FROM cost_model_products c2
  WHERE c2.product_id = ai.product_id
    AND c2.effective_from <= COALESCE(ai.order_day, date('now'))
  ORDER BY c2.effective_from DESC,
           CASE WHEN c2.cost_source = 'verified' THEN 1 ELSE 0 END DESC,
           c2.id DESC
  LIMIT 1
);
CREATE VIEW analysis_profit_orders AS
SELECT
  co.id AS sales_order_id,
  co.channel_norm,
  co.order_day,
  co.currency,
  co.order_total,
  COALESCE(agg.items, 0)         AS items,
  COALESCE(agg.costed_items, 0)  AS costed_items,
  COALESCE(agg.estimate_items, 0) AS estimate_cost_items,
  agg.production_cost_thb,
  CASE
    WHEN COALESCE(agg.items, 0) = 0 THEN 'ITEMLESS'
    WHEN agg.costed_items = agg.items THEN 'FULL'
    WHEN agg.costed_items > 0 THEN 'PARTIAL'
    ELSE 'NONE'
  END AS cost_coverage,
  f.id IS NOT NULL               AS has_fee_config,
  f.is_estimate                  AS fees_are_estimate,
  CASE
    WHEN f.id IS NOT NULL AND co.currency = 'THB' AND co.order_total IS NOT NULL
    THEN co.order_total * (f.marketplace_fee_pct + f.payment_fee_pct) / 100.0
         + f.payment_fee_fixed_thb + f.other_fee_thb_per_order
  END AS fees_thb,
  s.avg_shipping_cost_thb        AS shipping_cost_thb,
  s.is_estimate                  AS shipping_is_estimate,
  CASE
    WHEN co.currency = 'THB' AND co.order_total IS NOT NULL
         AND COALESCE(agg.items, 0) > 0 AND agg.costed_items = agg.items
    THEN co.order_total - agg.production_cost_thb
  END AS gross_margin_thb,
  CASE
    WHEN co.currency = 'THB' AND co.order_total IS NOT NULL
         AND COALESCE(agg.items, 0) > 0 AND agg.costed_items = agg.items
         AND f.id IS NOT NULL
    THEN co.order_total - agg.production_cost_thb
         - (co.order_total * (f.marketplace_fee_pct + f.payment_fee_pct) / 100.0
            + f.payment_fee_fixed_thb + f.other_fee_thb_per_order)
  END AS contribution_before_shipping_thb,
  CASE
    WHEN co.currency = 'THB' AND co.order_total IS NOT NULL
         AND COALESCE(agg.items, 0) > 0 AND agg.costed_items = agg.items
         AND f.id IS NOT NULL AND s.id IS NOT NULL
    THEN co.order_total - agg.production_cost_thb
         - (co.order_total * (f.marketplace_fee_pct + f.payment_fee_pct) / 100.0
            + f.payment_fee_fixed_thb + f.other_fee_thb_per_order)
         - s.avg_shipping_cost_thb
  END AS contribution_margin_thb
FROM analysis_commercial_orders co
LEFT JOIN (
  SELECT
    sales_order_id,
    COUNT(*)                                   AS items,
    SUM(cost_status = 'COSTED')                AS costed_items,
    SUM(cost_status = 'COSTED' AND cost_is_estimate = 1) AS estimate_items,
    SUM(item_production_cost_thb)              AS production_cost_thb
  FROM analysis_profit_items
  GROUP BY sales_order_id
) agg ON agg.sales_order_id = co.id
LEFT JOIN cost_model_channel_fees f ON f.id = (
  SELECT f2.id FROM cost_model_channel_fees f2
  WHERE f2.channel = co.channel_norm
    AND f2.effective_from <= COALESCE(co.order_day, date('now'))
  ORDER BY f2.effective_from DESC, f2.id DESC
  LIMIT 1
)
LEFT JOIN cost_model_shipping s ON s.id = (
  SELECT s2.id FROM cost_model_shipping s2
  WHERE s2.channel = co.channel_norm
    AND s2.effective_from <= COALESCE(co.order_day, date('now'))
  ORDER BY s2.effective_from DESC, s2.id DESC
  LIMIT 1
);
CREATE VIEW analysis_profit_monthly AS
SELECT
  substr(order_day, 1, 7) AS month,
  channel_norm,
  COUNT(*)                AS orders,
  SUM(order_total)        AS revenue,
  SUM(CASE WHEN cost_coverage = 'FULL' AND currency = 'THB' THEN 1 ELSE 0 END) AS full_cost_orders,
  SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN order_total END)             AS gross_covered_revenue,
  SUM(gross_margin_thb)                                                        AS gross_margin_thb,
  SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN order_total END) AS contrib_bs_covered_revenue,
  SUM(contribution_before_shipping_thb)                                        AS contribution_before_shipping_thb,
  SUM(CASE WHEN contribution_margin_thb IS NOT NULL THEN order_total END)      AS contrib_covered_revenue,
  SUM(contribution_margin_thb)                                                 AS contribution_margin_thb,
  MAX(CASE WHEN estimate_cost_items > 0 OR fees_are_estimate = 1 OR shipping_is_estimate = 1 THEN 1 ELSE 0 END) AS contains_estimates
FROM analysis_profit_orders
WHERE order_day IS NOT NULL AND length(order_day) = 10
GROUP BY substr(order_day, 1, 7), channel_norm;
CREATE VIEW analysis_profit_after_ads_monthly AS
SELECT
  m.month,
  SUM(m.orders)                             AS orders,
  SUM(m.revenue)                            AS revenue,
  SUM(m.contribution_before_shipping_thb)   AS contribution_before_shipping_thb,
  SUM(m.contrib_bs_covered_revenue)         AS contrib_bs_covered_revenue,
  ads.ads_cost_thb,
  CASE
    WHEN SUM(m.contribution_before_shipping_thb) IS NOT NULL
    THEN SUM(m.contribution_before_shipping_thb) - COALESCE(ads.ads_cost_thb, 0)
  END AS contribution_after_ads_thb
FROM analysis_profit_monthly m
LEFT JOIN (
  SELECT substr(report_date, 1, 7) AS month, SUM(cost) AS ads_cost_thb
  FROM google_ads_campaign_daily
  WHERE currency IN ('THB', '')
  GROUP BY substr(report_date, 1, 7)
) ads ON ads.month = m.month
GROUP BY m.month;
CREATE VIEW analysis_profit_coverage AS
SELECT
  (SELECT COUNT(*) FROM products WHERE is_active = 1)                          AS active_products,
  (SELECT COUNT(DISTINCT product_id) FROM cost_model_products)                 AS products_with_cost,
  (SELECT COUNT(DISTINCT product_id) FROM cost_model_products WHERE cost_source = 'verified') AS products_with_verified_cost,
  (SELECT COUNT(DISTINCT channel) FROM cost_model_channel_fees)                AS channels_with_fees,
  (SELECT COUNT(DISTINCT channel) FROM cost_model_shipping)                    AS channels_with_shipping,
  (SELECT COUNT(*) FROM analysis_profit_orders)                                AS commercial_orders,
  (SELECT COUNT(*) FROM analysis_profit_orders WHERE currency <> 'THB')        AS non_thb_orders,
  (SELECT COUNT(*) FROM analysis_profit_orders WHERE cost_coverage = 'FULL')   AS full_cost_orders,
  (SELECT COUNT(*) FROM analysis_profit_orders WHERE cost_coverage = 'PARTIAL') AS partial_cost_orders,
  (SELECT COUNT(*) FROM analysis_profit_orders WHERE cost_coverage = 'NONE')   AS no_cost_orders,
  (SELECT COUNT(*) FROM analysis_profit_orders WHERE cost_coverage = 'ITEMLESS') AS itemless_orders,
  (SELECT SUM(order_total) FROM analysis_profit_orders)                        AS total_revenue,
  (SELECT SUM(order_total) FROM analysis_profit_orders WHERE gross_margin_thb IS NOT NULL) AS gross_covered_revenue,
  (SELECT SUM(order_total) FROM analysis_profit_orders WHERE contribution_margin_thb IS NOT NULL) AS contribution_covered_revenue;
CREATE VIEW analysis_google_ads_daily AS
SELECT
  a.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT a.campaign_id) AS campaigns,
  COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_groups,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  SUM(COALESCE(a.all_conversions, 0)) AS all_conversions,
  SUM(COALESCE(a.all_conversions_value, 0)) AS all_conversions_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas,
  SUM(CASE WHEN a.product_id IS NOT NULL THEN a.cost ELSE 0 END) AS mapped_cost,
  SUM(CASE WHEN a.product_id IS NOT NULL THEN a.conversions ELSE 0 END) AS mapped_conversions
FROM google_ads_campaign_daily a
WHERE a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY a.report_date;
CREATE VIEW analysis_google_ads_campaign_daily AS
SELECT
  a.report_date,
  a.customer_id,
  a.customer_name,
  a.campaign_id,
  a.campaign_name,
  a.ad_group_id,
  a.ad_group_name,
  a.channel_type,
  a.network,
  a.device,
  a.currency,
  a.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  SUM(COALESCE(a.all_conversions, 0)) AS all_conversions,
  SUM(COALESCE(a.all_conversions_value, 0)) AS all_conversions_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas
FROM google_ads_campaign_daily a
LEFT JOIN products p ON p.id = a.product_id
WHERE a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY
  a.report_date, a.customer_id, a.customer_name, a.campaign_id, a.campaign_name,
  a.ad_group_id, a.ad_group_name, a.channel_type, a.network, a.device, a.currency,
  a.product_id, p.slug, p.title_en;
CREATE VIEW analysis_google_ads_product_daily AS
SELECT
  a.report_date,
  a.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COUNT(DISTINCT a.campaign_id) AS campaign_count,
  COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_group_count,
  SUM(a.impressions) AS impressions,
  SUM(a.clicks) AS clicks,
  SUM(a.cost) AS cost,
  SUM(a.conversions) AS conversions,
  SUM(a.conversion_value) AS conversion_value,
  CASE WHEN SUM(a.impressions) > 0
       THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
  END AS ctr_pct,
  CASE WHEN SUM(a.clicks) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
  END AS cpc,
  CASE WHEN SUM(a.conversions) > 0
       THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
  END AS cpa,
  CASE WHEN SUM(a.cost) > 0
       THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
  END AS roas
FROM google_ads_campaign_daily a
JOIN products p ON p.id = a.product_id
WHERE a.product_id IS NOT NULL
  AND a.report_date IS NOT NULL AND length(a.report_date) = 10
GROUP BY a.report_date, a.product_id, p.slug, p.title_en;
CREATE VIEW analysis_google_ads_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.cost, 0) AS cost_28d,
  COALESCE(cur.clicks, 0) AS clicks_28d,
  COALESCE(cur.impressions, 0) AS impressions_28d,
  COALESCE(cur.conversions, 0) AS conversions_28d,
  COALESCE(cur.conversion_value, 0) AS conversion_value_28d,
  COALESCE(prev.cost, 0) AS cost_prev_28d,
  COALESCE(prev.clicks, 0) AS clicks_prev_28d,
  COALESCE(prev.impressions, 0) AS impressions_prev_28d,
  COALESCE(prev.conversions, 0) AS conversions_prev_28d,
  COALESCE(prev.conversion_value, 0) AS conversion_value_prev_28d,
  CASE WHEN COALESCE(cur.conversions, 0) > 0
       THEN ROUND(cur.cost / cur.conversions, 2)
  END AS cpa_28d,
  CASE WHEN COALESCE(cur.cost, 0) > 0
       THEN ROUND(cur.conversion_value / cur.cost, 2)
  END AS roas_28d,
  CASE WHEN COALESCE(prev.conversions, 0) > 0
       THEN ROUND(prev.cost / prev.conversions, 2)
  END AS cpa_prev_28d,
  CASE WHEN COALESCE(prev.cost, 0) > 0
       THEN ROUND(prev.conversion_value / prev.cost, 2)
  END AS roas_prev_28d,
  CASE WHEN COALESCE(prev.cost, 0) > 0
       THEN ROUND((COALESCE(cur.cost, 0) - prev.cost) * 100.0 / prev.cost, 2)
  END AS cost_growth_pct,
  CASE WHEN COALESCE(prev.conversions, 0) > 0
       THEN ROUND((COALESCE(cur.conversions, 0) - prev.conversions) * 100.0 / prev.conversions, 2)
  END AS conversions_growth_pct,
  CASE WHEN COALESCE(prev.conversion_value, 0) > 0
       THEN ROUND((COALESCE(cur.conversion_value, 0) - prev.conversion_value) * 100.0 / prev.conversion_value, 2)
  END AS conversion_value_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SUM(conversions) AS conversions,
    SUM(conversion_value) AS conversion_value
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(impressions) AS impressions,
    SUM(conversions) AS conversions,
    SUM(conversion_value) AS conversion_value
  FROM google_ads_campaign_daily
  WHERE product_id IS NOT NULL
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;
CREATE VIEW analysis_google_ads_freshness AS
SELECT
  (SELECT MAX(report_date) FROM google_ads_campaign_daily) AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM google_ads_campaign_daily) AS days_since_latest_report,
  (SELECT COUNT(*) FROM google_ads_campaign_daily) AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'google-ads-%' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'google-ads-%'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'google-ads-%') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'google-ads-%'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
CREATE VIEW analysis_ga4_daily AS
SELECT
  g.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT g.landing_page_path) AS landing_pages,
  COUNT(DISTINCT g.page_path) AS page_paths,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
  END AS engagement_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.sessions ELSE 0 END) AS mapped_sessions,
  SUM(CASE WHEN g.product_id IS NOT NULL THEN g.product_views ELSE 0 END) AS mapped_product_views
FROM ga4_funnel_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
  AND g.landing_page_path NOT LIKE '%/listing/%'
GROUP BY g.report_date;
CREATE VIEW analysis_ga4_page_daily AS
SELECT
  g.report_date,
  g.landing_page_path,
  g.page_path,
  g.product_id,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct
FROM ga4_funnel_daily g
WHERE g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
  AND g.landing_page_path NOT LIKE '%/listing/%'
GROUP BY g.report_date, g.landing_page_path, g.page_path, g.product_id;
CREATE VIEW analysis_ga4_product_daily AS
SELECT
  g.report_date,
  g.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(g.product_views) AS product_views,
  SUM(g.add_to_cart) AS add_to_cart,
  SUM(g.begin_checkout) AS begin_checkout,
  SUM(g.purchases) AS purchases,
  SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
  END AS add_to_cart_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
  END AS checkout_rate_pct,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
  END AS purchase_rate_pct
FROM ga4_funnel_daily g
JOIN products p ON p.id = g.product_id
WHERE g.product_id IS NOT NULL
  AND g.report_date IS NOT NULL AND length(g.report_date) = 10
  AND g.property_scope = 'website'
GROUP BY g.report_date, g.product_id, p.slug, p.title_en;
CREATE VIEW analysis_ga4_product_28d AS
SELECT
  base.product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  COALESCE(cur.sessions, 0) AS sessions_28d,
  COALESCE(cur.product_views, 0) AS product_views_28d,
  COALESCE(cur.add_to_cart, 0) AS add_to_cart_28d,
  COALESCE(cur.begin_checkout, 0) AS begin_checkout_28d,
  COALESCE(cur.purchases, 0) AS purchases_28d,
  COALESCE(cur.purchase_revenue, 0) AS purchase_revenue_28d,
  COALESCE(prev.sessions, 0) AS sessions_prev_28d,
  COALESCE(prev.product_views, 0) AS product_views_prev_28d,
  COALESCE(prev.add_to_cart, 0) AS add_to_cart_prev_28d,
  COALESCE(prev.begin_checkout, 0) AS begin_checkout_prev_28d,
  COALESCE(prev.purchases, 0) AS purchases_prev_28d,
  COALESCE(prev.purchase_revenue, 0) AS purchase_revenue_prev_28d,
  CASE WHEN COALESCE(prev.sessions, 0) > 0
       THEN ROUND((COALESCE(cur.sessions, 0) - prev.sessions) * 100.0 / prev.sessions, 2)
  END AS sessions_growth_pct,
  CASE WHEN COALESCE(prev.purchases, 0) > 0
       THEN ROUND((COALESCE(cur.purchases, 0) - prev.purchases) * 100.0 / prev.purchases, 2)
  END AS purchases_growth_pct
FROM (
  SELECT DISTINCT product_id
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-56 day')
) base
JOIN products p ON p.id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(sessions) AS sessions,
    SUM(product_views) AS product_views,
    SUM(add_to_cart) AS add_to_cart,
    SUM(begin_checkout) AS begin_checkout,
    SUM(purchases) AS purchases,
    SUM(COALESCE(purchase_revenue, 0)) AS purchase_revenue
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-28 day')
  GROUP BY product_id
) cur ON cur.product_id = base.product_id
LEFT JOIN (
  SELECT
    product_id,
    SUM(sessions) AS sessions,
    SUM(product_views) AS product_views,
    SUM(add_to_cart) AS add_to_cart,
    SUM(begin_checkout) AS begin_checkout,
    SUM(purchases) AS purchases,
    SUM(COALESCE(purchase_revenue, 0)) AS purchase_revenue
  FROM ga4_funnel_daily
  WHERE product_id IS NOT NULL
    AND property_scope = 'website'
    AND report_date >= date('now', '-56 day')
    AND report_date <  date('now', '-28 day')
  GROUP BY product_id
) prev ON prev.product_id = base.product_id;
CREATE VIEW analysis_ga4_freshness AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily WHERE property_scope = 'website') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily WHERE property_scope = 'website') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily WHERE property_scope = 'website') AS total_rows,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE (source LIKE 'ga4-worker-cron:website' OR source = 'ga4-worker-cron')
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
CREATE VIEW analysis_ga4_etsy_daily AS
SELECT
  g.report_date,
  COUNT(*) AS rows_count,
  COUNT(DISTINCT g.listing_id) AS listings,
  SUM(g.sessions) AS sessions,
  SUM(g.users) AS users,
  SUM(g.engaged_sessions) AS engaged_sessions,
  SUM(CASE WHEN g.listing_id IS NOT NULL THEN g.sessions ELSE 0 END) AS listing_sessions,
  SUM(CASE WHEN m.product_id IS NOT NULL THEN g.sessions ELSE 0 END) AS mapped_sessions
FROM ga4_funnel_daily g
LEFT JOIN etsy_listing_master m ON m.listing_id = g.listing_id
WHERE g.property_scope = 'etsy'
  AND g.report_date IS NOT NULL AND length(g.report_date) = 10
GROUP BY g.report_date;
CREATE VIEW analysis_ga4_etsy_listing_28d AS
SELECT
  g.listing_id,
  m.product_id AS product_id,
  p.slug AS product_slug,
  p.title_en AS product_title,
  SUM(g.sessions) AS sessions_28d,
  SUM(g.users) AS users_28d,
  SUM(g.engaged_sessions) AS engaged_sessions_28d,
  CASE WHEN SUM(g.sessions) > 0
       THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
  END AS engagement_rate_pct
FROM ga4_funnel_daily g
JOIN etsy_listing_master m ON m.listing_id = g.listing_id
LEFT JOIN products p ON p.id = m.product_id
WHERE g.property_scope = 'etsy'
  AND g.listing_id IS NOT NULL
  AND g.report_date >= date('now', '-28 day')
GROUP BY g.listing_id, m.product_id, p.slug, p.title_en;
CREATE VIEW analysis_ga4_freshness_etsy AS
SELECT
  (SELECT MAX(report_date) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS latest_report_date,
  (SELECT CASE WHEN MAX(report_date) IS NOT NULL
          THEN CAST(julianday('now') - julianday(MAX(report_date)) AS INTEGER)
          END
   FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS days_since_latest_report,
  (SELECT COUNT(*) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS total_rows,
  (SELECT COUNT(DISTINCT listing_id) FROM ga4_funnel_daily
    WHERE property_scope = 'etsy' AND listing_id IS NOT NULL) AS distinct_listings,
  (SELECT SUM(
      CASE WHEN EXISTS (
        SELECT 1
        FROM etsy_listing_master m
        WHERE m.listing_id = g.listing_id
          AND m.product_id IS NOT NULL
      )
      THEN g.sessions ELSE 0 END
    )
   FROM ga4_funnel_daily g
   WHERE g.property_scope = 'etsy') AS mapped_sessions,
  (SELECT SUM(sessions) FROM ga4_funnel_daily WHERE property_scope = 'etsy') AS total_sessions,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy' AND status = 'success') AS last_success_sync_at,
  (SELECT status FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy'
    ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1) AS last_sync_status,
  (SELECT MAX(COALESCE(finished_at, created_at)) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy') AS last_sync_at,
  (SELECT COUNT(*) FROM sync_runs
    WHERE source LIKE 'ga4-worker-cron:etsy'
      AND status IN ('failed', 'partial', 'error')
      AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')) AS sync_errors_7d;
