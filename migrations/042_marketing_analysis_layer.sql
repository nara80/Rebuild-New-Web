-- MildMate Migration 042
-- Marketing Decision System — D1 Sales Analytical Layer (Phase 03)
-- Additive SQL VIEWS only. Reads sales_orders / sales_order_items / sync_runs / products.
-- No canonical table is created, altered, or written.
-- Contract: 01_MildMate_Marketing/02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md
--
-- Rules encoded here (do not change without updating the Metric Contract):
--   Commercial order  = lower(status) IN ('paid','processing','shipped','completed')
--                       AND source_order_id NOT LIKE 'TEST-%'
--   Active item       = item_status = 'active'
--   Channel           = lower(trim(source_system))  (sales_orders.channel is display-only)
--   Analytics day     = substr(order_date, 1, 10)
--   Mapping           = derived from items (product_id), never from mapping_status columns
--   Product revenue   = SUM of EXACT line_revenue only; UNALLOCATED stays NULL, never 0

-- ── Base: commercial orders ──────────────────────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_commercial_orders AS
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

-- ── Base: active items of commercial orders ─────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_active_items AS
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

-- ── Derived per-order mapping status (M16) ──────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_order_mapping AS
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

-- ── Daily sales summary (M1–M6, M16, M18/M19 inputs) ────────────────────
-- Revenue is aggregated from orders and units from a per-order item rollup,
-- so multi-item orders can never duplicate order_total.

CREATE VIEW IF NOT EXISTS analysis_sales_daily AS
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

-- ── Product participation, all-time (M7–M10, M14) ───────────────────────
-- product_id NULL groups into a synthetic "(unmapped)" row so units always
-- reconcile with order-level totals.

CREATE VIEW IF NOT EXISTS analysis_product_participation AS
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

-- ── Product × channel (M15 input) ───────────────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_product_channel AS
SELECT
  ai.product_id,
  ai.channel_norm,
  COUNT(DISTINCT ai.sales_order_id) AS orders,
  SUM(ai.quantity)                  AS units,
  SUM(CASE WHEN ai.revenue_status = 'EXACT' THEN ai.line_revenue END) AS exact_revenue
FROM analysis_active_items ai
GROUP BY ai.product_id, ai.channel_norm;

-- ── Rolling 28-day product summary (M13) ────────────────────────────────
-- Driven from the union of both windows so products that dropped to zero
-- in the current window still appear with a negative growth signal.
-- growth_vs_previous is NULL (insufficient history), never 0, when the
-- previous window had no orders.

CREATE VIEW IF NOT EXISTS analysis_sales_28d AS
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

-- ── Rolling 90-day product summary (M13) ────────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_sales_90d AS
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

-- ── Co-purchase pairs (M11/M12 input) ───────────────────────────────────
-- Symmetric pairs stored once with product_a < product_b.
-- Attach rate = co_orders / orders_containing(anchor), computed in the API.

CREATE VIEW IF NOT EXISTS analysis_product_copurchase AS
SELECT
  a.product_id AS product_a,
  b.product_id AS product_b,
  COUNT(DISTINCT a.sales_order_id) AS co_orders
FROM (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) a
JOIN (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) b
  ON a.sales_order_id = b.sales_order_id AND a.product_id < b.product_id
GROUP BY a.product_id, b.product_id;

-- ── Data quality snapshot (M21, M23–M29 inputs) ─────────────────────────
-- Freshness minutes (M22) and the OK/Warning/Critical roll-up (M30) are
-- computed in the API layer, not in SQL.

CREATE VIEW IF NOT EXISTS analysis_data_quality AS
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
