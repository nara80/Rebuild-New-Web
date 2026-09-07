# MildMate Marketing Decision System — Phase 02
# Metric Contract & Analytical Data Design

**Date:** 2026-09-07
**Branch:** `feature/marketing-data-analyst`
**Status:** Design document (no code, no migrations). Authoritative input for Phase 03 (D1 Analytical Layer) and Phase 04 (Analysis API).
**Verified against:** production `mildmate-db-prod` (read-only inspection, 2026-09-07: 8 sales_orders, 10 sales_order_items, 12 sync_runs).

---

# 1. Canonical Identity Rules (fixed)

| Entity | Canonical key | Notes |
|---|---|---|
| Product | `products.id` | 32 active products (1–29, 32, 33, 34). Never renumber. Never join analytics by title/slug/SKU text. |
| Order | `(sales_orders.source_system, sales_orders.source_order_id)` | Enforced by UNIQUE constraint. `sales_orders.id` is the internal surrogate used for joins. |
| Order item | `(sales_order_items.sales_order_id, sales_order_items.source_item_key)` | Enforced by UNIQUE constraint. |
| Channel | normalized `source_system` (see §4) | The `channel` column is NULL on 7/8 production rows and is NOT reliable. |

**Operational website `orders` table is out of scope.** Website sales enter analytics only via `sales_orders` (source_system `website`). Never UNION the two tables.

---

# 2. Commercial Base Population (approved by owner, 2026-09-07)

All commercial KPIs are computed over **commercial orders** and their **active items**.

## 2.1 Status matrix

| `sales_orders.status` | Classification |
|---|---|
| `paid`, `processing`, `shipped`, `completed` | ✅ Commercial |
| `pending` | ❌ Excluded (not yet revenue; surface count in Data Quality only) |
| `cancelled`, `refunded` | ❌ Excluded from commercial KPIs (may be shown separately later) |
| `archived` | ❌ Excluded |
| NULL / unknown value | ❌ Excluded from commercial KPIs; counted as a data-quality warning |

Comparison is case-insensitive: `lower(status) IN ('paid','processing','shipped','completed')`.

## 2.2 Test-order exclusion

- Excluded when `source_order_id LIKE 'TEST-%'` (covers the known smoke-test order `line / TEST-MAKE-001`).
- Future test rows must follow the `TEST-` prefix convention; ad-hoc exceptions require adding an explicit exclusion to this contract first.

## 2.3 Active items

Item-level metrics use only rows with `item_status = 'active'`. Rows with `item_status = 'removed'` are soft-deleted by the sync API and must never contribute to units, participation, or revenue.

**SQL base (used by every analytical object):**

```sql
-- commercial orders
SELECT o.*
FROM sales_orders o
WHERE lower(o.status) IN ('paid','processing','shipped','completed')
  AND o.source_order_id NOT LIKE 'TEST-%'

-- active items of commercial orders
SELECT i.*
FROM sales_order_items i
JOIN <commercial orders> o ON o.id = i.sales_order_id
WHERE i.item_status = 'active'
```

---

# 3. Date / Time Rules

**Verified formats in production `order_date`:** date-only `2026-08-25` and ISO `2026-02-17T01:31:00.000+00:00` (UTC). Both must be handled.

| Rule | Definition |
|---|---|
| **Analytics day** | `substr(order_date, 1, 10)` → `YYYY-MM-DD`. Works for both observed formats. |
| **Date basis** | `order_date` (source-reported order time), NOT ingestion `created_at`. Ingestion time is used only for sync freshness. |
| **Timezone** | Analytics day is the **source-reported calendar date** (ISO rows are UTC). Documented limitation: an order placed shortly after midnight UTC may fall on the previous Bangkok (UTC+7) day. Accepted at current volume; revisit during Phase 08 historical backfill if day-level precision matters. |
| **Rolling windows** | `28d` = `order_day >= date('now','-28 day')`; previous period = `date('now','-56 day')` to `date('now','-28 day')` exclusive. Same pattern for `90d`/`180d`. `date('now')` in D1/SQLite is UTC. |
| **NULL / malformed order_date** | Excluded from daily/windowed views; counted in Data Quality as `orders_missing_date`. |
| **Sync timestamps** | `sync_runs.finished_at` (fallback `created_at`), treated as UTC. Matches the existing Super Admin `parseSyncTimestamp()` behavior. |

---

# 4. Channel / Source Normalization

- Canonical channel dimension = `lower(trim(source_system))`.
- Ingestion already normalizes via `SOURCE_MAP` in `workers/api/sales.ts`: `shopee, lazada, tiktok, line, whatsapp, etsy, ebay, facebook, website (mildmate→website), manual`.
- The `sales_orders.channel` free-text column is display metadata only; it must not drive grouping (verified NULL on 7/8 rows).
- Unexpected source values (not in the known list) are allowed in aggregates but flagged in Data Quality as `unknown_source_labels`.

---

# 5. Revenue Attribution Rules (hard guardrails)

| Level | Rule |
|---|---|
| Order revenue | `sales_orders.order_total` is authoritative (currency in `currency`, all THB today). |
| Item revenue, `revenue_status='EXACT'` | `line_revenue` is the real source amount; may be aggregated into Exact Product Revenue. |
| Item revenue, `revenue_status='UNALLOCATED'` | `line_revenue` IS NULL by API contract. Unknown ≠ zero. Never aggregated, never estimated, never equal-split. |
| Product revenue | Only the SUM of EXACT `line_revenue`. Always shown together with a coverage % so partial data cannot masquerade as complete. |
| Multi-currency (future) | Aggregate revenue per currency; do not silently mix currencies. Today: 100% THB, so single-currency display is safe. |

**Verified production state:** 10/10 items are UNALLOCATED → Exact Product Revenue = NULL for every product today, and the dashboard must render that as "no exact revenue data", not ฿0.

---

# 6. Mapping Rules (contract decision)

**Verified production quirk:** order-level `mapping_status` is NULL on 7/8 orders, while **100% of active items have `product_id` set**. The order-level column is unreliable.

**Contract: mapping is derived from items, not from `sales_orders.mapping_status`.**

| Term | Definition (per commercial order) |
|---|---|
| **Mapped order** | Has ≥1 active item AND every active item has `product_id IS NOT NULL` |
| **Partially mapped order** | Has ≥1 active item with `product_id` and ≥1 active item without |
| **Unmapped order** | Has ≥1 active item, none with `product_id` |
| **Itemless order** | Has 0 active items → data-quality warning, counted separately |
| **Mapped item** | Active item with `product_id IS NOT NULL` |

`sales_orders.mapping_status` and `sales_order_items.mapping_status` remain visible as raw source fields in the Sales Detail table, but never drive KPI math.

---

# 7. Metric Dictionary

All metrics below apply the §2 commercial base unless stated otherwise. "Items" always means active items of commercial orders.

## 7.1 Order metrics

| # | Metric | Definition | SQL logic |
|---|---|---|---|
| M1 | **Commercial Order Count** | Distinct commercial orders in period | `COUNT(DISTINCT o.id)` over commercial orders filtered by `order_day` |
| M2 | **Order Revenue** | Sum of order totals of commercial orders | `SUM(o.order_total)` — never derived from items |
| M3 | **Units** | Sum of item quantities | `SUM(i.quantity)` over active items |
| M4 | **Average Order Value (AOV)** | Revenue ÷ orders | `SUM(o.order_total) / COUNT(DISTINCT o.id)`; NULL when 0 orders |
| M5 | **Orders by Channel** | M1 grouped by normalized channel | `GROUP BY channel_norm` |
| M6 | **Revenue by Channel** | M2 grouped by normalized channel | `GROUP BY channel_norm` |

## 7.2 Product metrics (participation model — works with UNALLOCATED revenue)

| # | Metric | Definition | SQL logic |
|---|---|---|---|
| M7 | **Orders Containing Product** | Distinct commercial orders with ≥1 active item of product P | `COUNT(DISTINCT i.sales_order_id)` per `product_id` |
| M8 | **Product Quantity** | Units of product P sold | `SUM(i.quantity)` per `product_id` |
| M9 | **Exact Product Revenue** | Sum of EXACT line revenue for product P | `SUM(CASE WHEN i.revenue_status='EXACT' THEN i.line_revenue END)` → NULL when no EXACT rows |
| M10 | **Revenue Coverage (product)** | Share of product P's items that are EXACT | `exact_items * 1.0 / total_items` per product |
| M11 | **Attach Rate (B given A)** | Of orders containing anchor product A, share also containing B | `co_orders(A,B) / orders_containing(A)` — computed in API/UI from the co-purchase pairs |
| M12 | **Co-Purchase Count** | Orders containing both product A and product B (A < B stored once; symmetric) | self-join of distinct (order, product) pairs: `a.product_id < b.product_id` on same `sales_order_id` |
| M13 | **Product Growth 28d / 90d** | (current window − previous window) ÷ previous window, on M7 | NULL (not 0) when previous window is 0 — "insufficient history" |
| M14 | **Channel Count (product)** | Distinct channels where product P appears | `COUNT(DISTINCT channel_norm)` per product |
| M15 | **Top Channel (product)** | Channel with highest M7 for product P | rank by orders, tie-break by units then alphabetically |

## 7.3 Coverage / mapping metrics

| # | Metric | Definition | SQL logic |
|---|---|---|---|
| M16 | **Mapped Order %** | Mapped orders (§6) ÷ commercial orders with ≥1 active item | derived-from-items rule |
| M17 | **Mapped Item %** | Mapped items ÷ active items | `SUM(product_id IS NOT NULL) * 1.0 / COUNT(*)` |
| M18 | **Exact Revenue Coverage % (items)** | EXACT items ÷ active items | `SUM(revenue_status='EXACT') * 1.0 / COUNT(*)` |
| M19 | **Unallocated Revenue Coverage % (items)** | 100% − M18 (UNALLOCATED items ÷ active items) | complement; both shown so nothing hides |
| M20 | **Exact Revenue % of Order Revenue** | SUM(EXACT line_revenue) ÷ SUM(order_total) | lower-bound indicator; labelled "of total order revenue, exact-attributed" |

## 7.4 Sync / data-quality metrics

| # | Metric | Definition | SQL logic |
|---|---|---|---|
| M21 | **Last Successful Sales Sync** | Latest `sync_runs` row with `status='success'` | `MAX(COALESCE(finished_at, created_at))` where success |
| M22 | **Data Freshness** | Minutes since M21 (UTC now) | computed at API/UI level; matches existing banner thresholds |
| M23 | **Sync Error Count (7d)** | `sync_runs` with `status IN ('failed','partial','error')` in last 7 days | count |
| M24 | **Missing Product_ID Count** | Active items of commercial orders with `product_id IS NULL` | count (currently 0) |
| M25 | **Itemless Order Count** | Commercial orders with 0 active items | count |
| M26 | **Orders Missing Date** | Commercial orders with NULL/malformed `order_date` | count |
| M27 | **Unknown Source Labels** | Distinct `source_system` values outside the known list (§4) | list + count |
| M28 | **Excluded Order Counts** | Orders excluded by status (pending/cancelled/refunded/archived) and by TEST rule | grouped counts, shown in Data Quality only |
| M29 | **Invalid Product Reference** | Item `product_id` not present in `products` | count (FK guards this; belt-and-braces check) |
| M30 | **Data Quality Status** | OK / Warning / Critical roll-up | Critical: last sync failed or missing, or M29>0. Warning: freshness > 30 min (matches existing banner), M24>0, M25>0, M26>0, M27>0, M23>0. Else OK. |

---

# 8. Recommended Analytical Objects (for Phase 03, migration `042`)

**Decision: SQL VIEWS, not summary tables.** Dataset is tiny (8 orders); views are always-fresh, zero-maintenance, and additive. Revisit as tables only if Phase 08 backfill makes them slow.

Proposed migration: `migrations/042_marketing_analysis_layer.sql` — `CREATE VIEW IF NOT EXISTS` only, no ALTER/DROP of existing objects, no writes to canonical tables. Names must not collide with `ensureSalesSchema()` (they don't: all prefixed `analysis_`).

## 8.1 `analysis_commercial_orders` (base view)

```sql
CREATE VIEW IF NOT EXISTS analysis_commercial_orders AS
SELECT
  o.id,
  o.source_system,
  o.source_order_id,
  lower(trim(o.source_system))     AS channel_norm,
  substr(o.order_date, 1, 10)      AS order_day,
  o.order_date,
  o.currency,
  o.order_total,
  lower(o.status)                  AS status,
  o.destination_country,
  o.mapping_status                 AS raw_mapping_status,
  o.created_at,
  o.updated_at
FROM sales_orders o
WHERE lower(o.status) IN ('paid','processing','shipped','completed')
  AND o.source_order_id NOT LIKE 'TEST-%';
```

## 8.2 `analysis_active_items` (base view)

```sql
CREATE VIEW IF NOT EXISTS analysis_active_items AS
SELECT
  i.id, i.sales_order_id, i.source_item_key, i.item_no,
  i.product_id, i.quantity, i.raw_item_text,
  i.line_revenue, i.revenue_status,
  i.mapping_status AS raw_mapping_status,
  co.channel_norm, co.order_day, co.currency, co.order_total
FROM sales_order_items i
JOIN analysis_commercial_orders co ON co.id = i.sales_order_id
WHERE i.item_status = 'active';
```

## 8.3 `analysis_order_mapping` (per-order derived mapping)

```sql
CREATE VIEW IF NOT EXISTS analysis_order_mapping AS
SELECT
  co.id AS sales_order_id,
  COUNT(ai.id)                                   AS active_items,
  SUM(ai.product_id IS NOT NULL)                 AS mapped_items,
  CASE
    WHEN COUNT(ai.id) = 0 THEN 'Itemless'
    WHEN SUM(ai.product_id IS NULL) = 0 THEN 'Mapped'
    WHEN SUM(ai.product_id IS NOT NULL) > 0 THEN 'Partial'
    ELSE 'Unmapped'
  END AS derived_mapping_status
FROM analysis_commercial_orders co
LEFT JOIN analysis_active_items ai ON ai.sales_order_id = co.id
GROUP BY co.id;
```

## 8.4 `analysis_sales_daily`

Per `order_day × channel_norm`: `orders` (M1), `order_revenue` (M2), `units` (M3 via correlated item sum), `aov`, `mapped_orders`, `exact_items`, `unallocated_items`. Units and revenue computed from separate aggregates (orders vs items) — **never join-then-SUM `order_total`, which would duplicate multi-item orders**.

## 8.5 `analysis_product_participation`

Per `product_id` (all-time): `orders_containing_product` (M7), `quantity` (M8), `exact_revenue` (M9, NULL-safe), `exact_items`, `total_items`, `channel_count` (M14), joined to `products.id/slug/title_en` for display. Unmapped items (`product_id IS NULL`) roll into a synthetic "(unmapped)" row so quantities always reconcile to order totals.

## 8.6 `analysis_product_channel`

Per `product_id × channel_norm`: orders, units, exact_revenue. Feeds M15 Top Channel (ranked at API level).

## 8.7 `analysis_sales_28d` / `analysis_sales_90d`

Per `product_id`: current-window orders/units/exact_revenue vs previous-window orders, `growth_vs_previous` (M13, NULL when previous = 0), computed with `date('now','-28 day')` / `-56 day` (and 90/180).

## 8.8 `analysis_product_copurchase`

```sql
CREATE VIEW IF NOT EXISTS analysis_product_copurchase AS
SELECT a.product_id AS product_a, b.product_id AS product_b,
       COUNT(DISTINCT a.sales_order_id) AS co_orders
FROM (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) a
JOIN (SELECT DISTINCT sales_order_id, product_id FROM analysis_active_items WHERE product_id IS NOT NULL) b
  ON a.sales_order_id = b.sales_order_id AND a.product_id < b.product_id
GROUP BY a.product_id, b.product_id;
```

Attach rate (M11) = `co_orders / orders_containing(anchor)`, computed in the API for either direction.

## 8.9 `analysis_data_quality`

Single-row view exposing M21–M29 inputs: last successful sync, last sync status, sync errors 7d, commercial/excluded/test order counts, mapped order/item counts, exact/unallocated item counts, missing product_id, itemless orders, orders missing date. M22 freshness and M30 roll-up are computed at the API layer (time math + thresholds belong in code, not the view).

---

# 9. Test Cases (walkthroughs against verified production rows)

Expected results any Phase 03 implementation MUST reproduce (as of 2026-09-07 data):

| Check | Expected |
|---|---|
| Commercial orders (M1, all-time) | **7** (order id 1 excluded: `TEST-MAKE-001`) |
| Order revenue (M2) | **฿20,872** = 1290+4448+2286+2711+335+1842+7960 |
| Units (M3) | **13** = 1+ (2+2) +1+1+2+1+ (2+1) |
| AOV (M4) | **฿2,981.71** (20872 ÷ 7) |
| Orders by channel (M5) | shopee 5, tiktok 1, facebook 1 (line 0 — test excluded) |
| Single-item order walkthrough | order id 4 (shopee `2602073RDAF1HD`): 1 order, 1 unit (P10), ฿2,286; Mapped |
| Multi-item order walkthrough | order id 3 (shopee `2602073QYC6J99`): 1 order, 4 units (P2 ×2, P15 ×2), ฿4,448; participation +1 for P2 AND P15; co-purchase pair (2,15) +1 |
| Multi-product order walkthrough | order id 8 (facebook `71324577Fa`): units 3 (P6 ×2, P18 ×1), pair (6,18) +1 |
| UNALLOCATED walkthrough | every item: `line_revenue` NULL → Exact Product Revenue NULL for all products; M18 = 0%, M19 = 100%; dashboard shows "no exact revenue", never ฿0 |
| Test-order walkthrough | order id 1 (`line/TEST-MAKE-001`, ฿100, P26): appears in NO commercial metric; appears in Data Quality excluded counts (test=1) |
| Mapped Order % (M16) | **100%** (7/7 — derived from items, despite `mapping_status` NULL on the raw rows) |
| Mapped Item % (M17) | **100%** (10/10 active items have product_id; 9 belong to commercial orders → 9/9) |
| Missing Product_ID (M24) | 0 |
| Last successful sync (M21) | `2026-09-07T09:12:47.854Z`; sync errors 7d = 0 |
| Product participation spot-check | P2: 2 orders (ids 3, 5), 3 units. P6: 2 orders (ids 7, 8), 3 units. P26 commercial: 1 order (id 2), 1 unit |
| Empty-period check | any date range before 2026-02-07 → 0 orders, revenue NULL/0, AOV NULL, no errors |

No metric anywhere depends on invented line revenue. ✅

---

# 10. Risks / Unresolved Questions

1. **Timezone bucketing** (§3): analytics day is source-reported (≈UTC); Bangkok-day drift accepted for now; revisit at Phase 08.
2. **Tiny dataset:** 7 commercial orders means growth/co-purchase metrics are statistically weak; the dashboard must show sample sizes (this is by design — Data Confidence, Phase 13/14).
3. **Order-level `mapping_status` unreliable** (NULL from the Make.com scenario): contract works around it by deriving from items; optionally fix the scenario later (out of scope here).
4. **`channel` column unused** by contract; if the business later wants sub-channel labels (e.g., "Line OA" vs "Line Shopping"), extend ingestion first.
5. **Currency:** single-currency (THB) assumption is safe today; views group by `currency` where revenue is summed so a future USD row cannot silently mix.
6. **`date('now')` windows in views** make 28d/90d views time-dependent (fine) but non-deterministic in tests — Phase 03 tests should validate the underlying daily/base views with fixed dates plus one live smoke-check of the windowed views.

---

# 11. Phase 02 Handoff Record

- **Files changed:** this document only (plus handoff note). No code, no migrations, no schema, no deploy.
- **Production access:** read-only SELECTs against `mildmate-db-prod` via wrangler (value-domain verification).
- **Approvals captured:** commercial statuses (`paid/processing/shipped/completed`, `pending` excluded) and routes (`/super-admin/marketing/data-analyst/`, `/api/admin/analysis/*`) approved by owner 2026-09-07.
- **Next phase:** Phase 03 — implement `migrations/042_marketing_analysis_layer.sql` with the §8 views, validate against the §9 expected results (preview DB first, then prod after approval).
