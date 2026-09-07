# Phase 03 Handoff — D1 Sales Analytical Layer

**Date:** 2026-09-07 · **Branch:** `feature/marketing-data-analyst` · **Status:** ✅ Built + verified on preview DB. ⏳ NOT applied to production (awaiting explicit approval).

## Files changed

- `migrations/042_marketing_analysis_layer.sql` — NEW, additive `CREATE VIEW IF NOT EXISTS` only. No canonical table created/altered/written. No historical migration touched.

## SQL objects created (10 views)

| View | Purpose (Metric Contract ref) |
|---|---|
| `analysis_commercial_orders` | Base: commercial status filter + `TEST-%` exclusion + `channel_norm` + `order_day` |
| `analysis_active_items` | Base: active items of commercial orders |
| `analysis_order_mapping` | Derived per-order mapping (Mapped/Partial/Unmapped/Itemless) from items (M16) |
| `analysis_sales_daily` | Day × channel: orders, revenue, AOV, units, mapped, exact/unallocated (M1–M6) |
| `analysis_product_participation` | Per product all-time: orders, qty, EXACT revenue, coverage, channels (M7–M10, M14) |
| `analysis_product_channel` | Product × channel (M15 input) |
| `analysis_sales_28d` / `analysis_sales_90d` | Rolling windows with growth vs previous (M13; NULL when no history) |
| `analysis_product_copurchase` | Symmetric product pairs, `product_a < product_b` (M11/M12 input) |
| `analysis_data_quality` | Single-row snapshot (M21, M23–M29 inputs) |

## Database state

- **Preview `mildmate-db`:** migration 039 applied (tables didn't exist there), migration 042 applied, seeded with a clone of the 8 production sales rows (no PII in these tables) **plus synthetic edge-case rows (order ids 20–25, item ids 20–23)** left in place for Phase 04/05 API+UI testing.
- **Production `mildmate-db-prod`:** **untouched.** Apply command (after approval): `npx wrangler d1 execute mildmate-db-prod --remote --file migrations/042_marketing_analysis_layer.sql`

## Tests performed (all passed)

**Contract §9 reproduction on prod-clone seed:**
7 orders · ฿20,872 · 13 units · AOV 2,981.71 · shopee 5 / tiktok 1 / facebook 1 · P2(2 orders/3 units), P6(2/3, 2 channels) · co-purchase (2,15)=1, (6,18)=1 · mapping 100% derived-Mapped despite NULL raw `mapping_status` · exact_revenue NULL everywhere (never 0) · TEST-MAKE-001 fully excluded · 28d/90d empty without error (data older than window).

**Edge-case battery (synthetic rows):**
- `cancelled` + `pending` → excluded from commercial, counted as `excluded_status_orders = 2`
- unknown status `weird` → `unknown_status_orders = 1`, not commercial
- itemless shipped order → commercial, `itemless_orders = 1`
- `item_status='removed'` (qty 5) → correctly excluded from units (16, not 21)
- EXACT item (฿500, product 26) → `exact_revenue = 500`, coverage 1/2 items; UNALLOCATED never summed
- unmapped item (`product_id NULL`) → order becomes `Partial`, participation shows "(unmapped)" row, `missing_product_id_items = 1`
- unknown source `randomshop` → `unknown_source_labels = 1`
- 28d window picks up only recent rows; `growth_vs_previous = NULL` (not 0) with no prior history

## Notes / risks carried forward

1. **Product titles come from D1 `products.id`** (e.g. id 10 = "3-Sided Zipper Duvet Cover", id 15 = "Duvet Insert") — the AGENTS.md catalog table numbering is NOT the D1 id; always trust `products.id`.
2. 28d/90d views use `date('now')` (UTC) — time-dependent by design.
3. No new indexes added: views ride existing migration-039 indexes; dataset is tiny. Revisit after Phase 08 backfill with real query plans.
4. Runtime bundle parity (`public/_worker.js` / `public/index.js`) must be verified at the start of Phase 04 before adding API endpoints.

## Phase 04 instructions

Build read-only `/api/admin/analysis/*` endpoints (`workers/api/admin-analysis.ts`, registered in `functions/api/[[path]].ts`) reading ONLY these views, reusing the `admin-stats.ts` auth pattern. Preview DB is pre-seeded for testing. Do not build the dashboard UI yet.
