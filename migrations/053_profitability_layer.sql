-- MildMate Migration 053
-- Marketing Decision System — Phase 13: Profitability & Contribution Margin Layer
-- Additive only: controlled cost tables + profitability views on top of the
-- Phase 03 analysis views (migration 042). No canonical table is altered.
--
-- Owner decisions encoded here (approved 2026-10-02, discovery-first revision):
--   Production cost  = REUSE: derived from live D1 `pricing_params` via the
--                      existing verified formula families (cost_source='formula',
--                      is_estimate=1, ESTIMATED) at owner-approved reference
--                      sizes. Thin override only: cost_source='verified'
--                      (is_estimate=0, EXACT/VERIFIED) for owner-verified actual
--                      costs and products with no cost formula.
--                      No full parallel manual cost table — formula truth stays
--                      in pricing_params + formula code.
--   Shipping cost    = REUSE: existing D1 shipping charge ÷ 1.05
--                      (owner: shipping is pass-through; customer charge carries
--                      a 5% buffer over courier cost), labelled
--                      ESTIMATED_SHIPPING_COST. The commercial 30 THB/USD FX
--                      buffer stays OUT of profitability accounting.
--                      Precedence: verified courier cost → charge ÷ 1.05 →
--                      UNKNOWN (no row). Never substitute zero for MISSING.
--   Fees             = effective-dated per-channel fee table (marketplace %,
--                      payment % + fixed, other per-order THB). Seeded with
--                      labelled estimates for the 8 known channels. This is the
--                      ONLY input D1 genuinely lacked before Phase 13.
--   Ad attribution   = period aggregate only (monthly view subtracts Google
--                      Ads spend at month level; never allocated per order).
--
-- Precedence chain (per item):
--   1. VERIFIED_EXACT  — cost_model_products cost_source='verified' (is_estimate=0)
--   2. FORMULA         — cost_source='formula', derived from live D1
--                        pricing_params + existing formula families
--   3. CONTROLLED      — labelled estimate rows only (never invented silently)
--   4. UNKNOWN         — NULL. Missing cost is never written or read as zero.
--
-- Rules (extend the Metric Contract; do not change silently):
--   All costs are THB. Profitability is computed ONLY for currency='THB'
--     orders; other currencies are excluded and surface in coverage.
--   Missing cost/fee/shipping => NULL margin, never 0.
--   Estimates stay labelled end-to-end (is_estimate / *_is_estimate flags).
--   Effective dating: the row with the greatest effective_from <= order_day
--     applies; 'verified' outranks 'formula' on the same effective_from.
--   Gross margin requires FULL production-cost coverage of the order.
--   Contribution (before shipping) additionally requires a fee config row.
--   Contribution margin additionally requires a shipping estimate row.
--   Channel identity = channel_norm = lower(trim(source_system))
--     (sales_orders.channel is display-only, NULL on nearly all rows).

-- ── Controlled cost tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cost_model_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  production_cost_thb REAL NOT NULL,
  cost_source TEXT NOT NULL DEFAULT 'formula',     -- 'verified' | 'formula'
  is_estimate INTEGER NOT NULL DEFAULT 1,          -- verified rows: 0 (EXACT/VERIFIED)
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(product_id, effective_from, cost_source)
);

CREATE INDEX IF NOT EXISTS idx_cost_model_products_lookup
  ON cost_model_products(product_id, effective_from);

CREATE TABLE IF NOT EXISTS cost_model_channel_fees (
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

CREATE INDEX IF NOT EXISTS idx_cost_model_channel_fees_lookup
  ON cost_model_channel_fees(channel, effective_from);

CREATE TABLE IF NOT EXISTS cost_model_shipping (
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

CREATE INDEX IF NOT EXISTS idx_cost_model_shipping_lookup
  ON cost_model_shipping(channel, effective_from);

-- ── Seed: channel fee estimates (all labelled is_estimate=1) ─────────────
-- effective_from 2023-01-01 covers the full historical backfill span.
-- Values are controlled starting estimates — confirm against channel
-- statements and update via Super Admin (new rows with later effective_from).

INSERT OR IGNORE INTO cost_model_channel_fees
  (channel, marketplace_fee_pct, payment_fee_pct, payment_fee_fixed_thb, other_fee_thb_per_order, is_estimate, effective_from, note)
VALUES
  ('etsy',     6.5, 4.0, 0, 15, 1, '2023-01-01', 'Estimate: Etsy transaction 6.5% + Etsy Payments ~4% + ~THB15/order listing renewal. Confirm against Etsy statements.'),
  ('website',  0.0, 3.65, 10, 0, 1, '2023-01-01', 'Estimate: Stripe Thailand ~3.65% + ~THB10 fixed. Confirm against Stripe statements.'),
  ('shopee',   8.0, 0.0, 0, 0, 1, '2023-01-01', 'Rough estimate: Shopee commission + transaction bundled ~8%. Rates changed over time — confirm against seller centre.'),
  ('lazada',   8.0, 0.0, 0, 0, 1, '2023-01-01', 'Rough estimate: Lazada commission + payment bundled ~8%. Confirm against seller centre.'),
  ('tiktok',   8.0, 0.0, 0, 0, 1, '2023-01-01', 'Rough estimate: TikTok Shop commission bundled ~8%. Confirm against seller centre.'),
  ('line',     0.0, 0.0, 0, 0, 1, '2023-01-01', 'Direct channel (bank transfer / PromptPay assumed): no marketplace or payment fee. Confirm.'),
  ('whatsapp', 0.0, 0.0, 0, 0, 1, '2023-01-01', 'Direct channel (bank transfer assumed): no marketplace or payment fee. Confirm.'),
  ('facebook', 0.0, 0.0, 0, 0, 1, '2023-01-01', 'Direct channel (bank transfer assumed): no marketplace or payment fee. Confirm.');

-- ── Seed: owner-verified production costs (EXACT/VERIFIED, is_estimate=0) ─
-- Fixed-price products with no cost formula. Owner-supplied 2026-10-02:
--   duvet-insert  THB 1,000 (average, every size)
--   bedbridge-connector  THB 450
--   mattress-lift-helper  THB 70

INSERT OR IGNORE INTO cost_model_products
  (product_id, production_cost_thb, cost_source, is_estimate, effective_from, note)
SELECT p.id, 1000, 'verified', 0, '2023-01-01',
  'Owner-verified average production cost, every size (fixed-price product, no formula). 2026-10-02.'
FROM products p WHERE p.slug = 'duvet-insert';
INSERT OR IGNORE INTO cost_model_products
  (product_id, production_cost_thb, cost_source, is_estimate, effective_from, note)
SELECT p.id, 450, 'verified', 0, '2023-01-01',
  'Owner-verified production cost (fixed-price product, no formula). 2026-10-02.'
FROM products p WHERE p.slug = 'bedbridge-connector';
INSERT OR IGNORE INTO cost_model_products
  (product_id, production_cost_thb, cost_source, is_estimate, effective_from, note)
SELECT p.id, 70, 'verified', 0, '2023-01-01',
  'Owner-verified production cost (fixed-price product, no formula). 2026-10-02.'
FROM products p WHERE p.slug = 'mattress-lift-helper';

-- ── Seed: per-channel ESTIMATED_SHIPPING_COST (charge ÷ 1.05) ────────────
-- Derived from existing D1 `shipping_rates` (owner rule 2026-10-02: shipping is
-- pass-through; the customer shipping charge carries a 5% buffer over courier
-- cost, so estimated cost = charge / 1.05). Per-channel average because
-- sales_orders.destination_country is populated on only 1 of 549 orders, so
-- per-order charges cannot be derived (v1 granularity: per-channel average).
--   International channels (etsy, website): US tier-2 first-item charge
--     THB 2,000 (fitted sheets = core product class, tier 2) → 2000/1.05.
--   Domestic TH channels (shopee, lazada, tiktok, line, whatsapp, facebook):
--     D1 shipping_rates TH first-item charge is genuinely THB 0 → 0/1.05 = 0.
--     This is a DERIVED value from a real zero charge, not a missing value.
--     Replace with verified courier actuals when available (precedence 1).

INSERT OR IGNORE INTO cost_model_shipping
  (channel, avg_shipping_cost_thb, is_estimate, effective_from, note)
VALUES
  ('etsy',     ROUND(2000 / 1.05, 2), 1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = US tier-2 first-item charge THB 2000 (D1 shipping_rates) ÷ 1.05. Replace with verified courier actuals.'),
  ('website',  ROUND(2000 / 1.05, 2), 1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = US tier-2 first-item charge THB 2000 (D1 shipping_rates) ÷ 1.05. Replace with verified courier actuals.'),
  ('shopee',   ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05 (platform logistics assumed within channel fee estimate). Replace with verified courier actuals.'),
  ('lazada',   ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05 (platform logistics assumed within channel fee estimate). Replace with verified courier actuals.'),
  ('tiktok',   ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05 (platform logistics assumed within channel fee estimate). Replace with verified courier actuals.'),
  ('line',     ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05. Replace with verified courier actuals.'),
  ('whatsapp', ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05. Replace with verified courier actuals.'),
  ('facebook', ROUND(0 / 1.05, 2),    1, '2023-01-01', 'ESTIMATED_SHIPPING_COST = D1 shipping_rates TH domestic charge THB 0 ÷ 1.05. Replace with verified courier actuals.');

-- (No formula cost rows are seeded here: POST /api/admin/cost-model/recalculate
--  generates them against live D1 pricing_params at owner-approved reference
--  sizes, cost_source='formula', is_estimate=1.)

-- ── View: per-item effective production cost ─────────────────────────────
-- Effective cost row = greatest effective_from <= order_day; 'verified'
-- outranks 'formula' on the same date. No cost row => NO_COST (never 0).

CREATE VIEW IF NOT EXISTS analysis_profit_items AS
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

-- ── View: per-order profitability ────────────────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_profit_orders AS
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

-- ── View: monthly profitability by channel ───────────────────────────────
-- Margin sums cover ONLY orders where that margin is computable; the paired
-- *_covered_revenue column states the revenue base so percentages are honest.

CREATE VIEW IF NOT EXISTS analysis_profit_monthly AS
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

-- ── View: monthly contribution after advertising (aggregate only) ────────
-- Ad spend is subtracted at month level across ALL channels vs ALL Google
-- Ads cost. It is never attributed to individual orders or products
-- (guardrail: no double-counting, no invented attribution).

CREATE VIEW IF NOT EXISTS analysis_profit_after_ads_monthly AS
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

-- ── View: profitability coverage snapshot ────────────────────────────────

CREATE VIEW IF NOT EXISTS analysis_profit_coverage AS
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
