-- MildMate Migration 039
-- Additive unified sales analytics layer (does not modify operational website order tables)

CREATE TABLE IF NOT EXISTS sales_orders (
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

CREATE TABLE IF NOT EXISTS sales_order_items (
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

CREATE TABLE IF NOT EXISTS sync_runs (
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

CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date
  ON sales_orders(order_date);

CREATE INDEX IF NOT EXISTS idx_sales_orders_channel
  ON sales_orders(channel);

CREATE INDEX IF NOT EXISTS idx_sales_orders_status
  ON sales_orders(status);

CREATE INDEX IF NOT EXISTS idx_sales_orders_notion_page
  ON sales_orders(notion_page_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_product
  ON sales_order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_order
  ON sales_order_items(sales_order_id);
