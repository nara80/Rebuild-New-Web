# MildMate Marketing Analysis API — Reference (Phase 04)

**Date:** 2026-09-07 · **Handler:** `workers/api/admin-analysis.ts` · **Registered in:** `functions/api/[[path]].ts` (`/api/admin/analysis*`) · **Runtime bundles:** `public/_worker.js` + `public/index.js` (rebuilt via `npx wrangler pages functions build`)

Read-only. Reads ONLY the `analysis_*` views (migration 042) plus `products` for display titles. No PII exists in these sources. GET only (405 otherwise).

## Authentication

Same pattern as `/api/admin/stats`:
1. `Authorization: Bearer <Clerk session token>` → JWT verified (JWKS) → admin role claim or email in `ADMIN_EMAILS` (Clerk API enrichment fallback).
2. Fallback `X-Admin-Secret` header — rejected on production hosts unless `ADMIN_SECRET_ALLOW_PROD=true`; used for local dev.
- No credentials → `401`. Valid JWT without admin role → `403`.

## Error schema (machine-readable)

```json
{ "success": false, "error_code": "INVALID_START_DATE", "message": "start must be YYYY-MM-DD." }
```

Codes: `UNAUTHORIZED`, `METHOD_NOT_ALLOWED`, `ROUTE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `INVALID_START_DATE`, `INVALID_END_DATE`, `INVALID_DATE_RANGE`, `INVALID_CHANNEL`, `INVALID_PRODUCT_ID`, `INVALID_STATUS`, `INVALID_REVENUE_STATUS`, `INVALID_LIMIT`, `INVALID_OFFSET`, `DATA_QUALITY_UNAVAILABLE`.

## Common query parameters

| Param | Format | Applies to |
|---|---|---|
| `start`, `end` | `YYYY-MM-DD` (inclusive, on `order_day`) | summary, sales, products, channels |
| `channel` | `^[a-z0-9-]{1,30}$` (normalized source_system) | summary, sales, products |
| `product_id` | positive integer | sales |
| `status` | `paid|processing|shipped|completed` (commercial only) | sales |
| `revenue_status` | `EXACT|UNALLOCATED` | sales |
| `limit` / `offset` | 1–200 (default 50) / ≥0 | sales |

## Endpoints

### GET `/api/admin/analysis/summary`
KPI header (M1–M4, M16, M18/M19). Empty period returns zeros with `null` for aov/percentages (never fake 0%).
```json
{ "success": true, "filters": {...}, "summary": { "orders": 7, "order_revenue": 20872, "currency": "THB",
  "units": 13, "aov": 2981.71, "mapped_orders": 7, "mapped_order_pct": 100,
  "exact_items": 0, "unallocated_items": 9, "exact_item_pct": 0, "unallocated_item_pct": 100 } }
```

### GET `/api/admin/analysis/sales`
Item-level Sales Detail rows (paginated, newest first): `order_day, channel_norm, source_system, source_order_id, status, order_total, currency, product_id, product_title, quantity, raw_item_text, line_revenue, revenue_status, derived_mapping_status` + `pagination: { total, limit, offset }`.

### GET `/api/admin/analysis/products`
Per-product participation (date/channel-filterable; aggregated live from `analysis_active_items` using identical contract logic since views can't take parameters): participation fields + `revenue_coverage_pct`, `top_channel` (from `analysis_product_channel`), `orders_28d`, `growth_vs_previous_28d` (from `analysis_sales_28d`). Unmapped items appear as a `product_id: null` "(unmapped)" row.

### GET `/api/admin/analysis/product/:id`
Product drill-down: `product` (id/slug/title/type/active), `participation`, `channels[]`, `window_28d`, `window_90d`, `co_purchase[]` (partner product, co_orders, `attach_rate_pct` vs this anchor). 404 if the product id does not exist.

### GET `/api/admin/analysis/channels`
Per channel: `orders, order_revenue, units, aov, mapped_orders, mapped_pct`.

### GET `/api/admin/analysis/data-quality`
`analysis_data_quality` row + computed `freshness_minutes` (M22), `mapped_order_pct`, `mapped_item_pct`, `exact_item_pct`, `unallocated_item_pct`, and M30 roll-up `status: ok|warning|critical` with human-readable `warnings[]`.
Thresholds: critical = no/failed sync or invalid product refs; warning = freshness > 30 min, sync errors 7d, missing Product_IDs, itemless orders, missing dates, unknown status/source labels.

## Test results (local `wrangler pages dev`, 2026-09-07)

| Test | Result |
|---|---|
| No auth → 401 · bad date → 400 · reversed range → 400 · bad route → 404 · product 999 → 404 | ✅ |
| Summary all-time and date+channel filtered | ✅ consistent with local views |
| Sales pagination (total stable across pages), product_id / revenue_status filters | ✅ |
| Products list with coverage %, top channel, 28d trend; product/26 detail with EXACT ฿500 | ✅ |
| Empty period → zeros with null aov/pcts | ✅ |
| No PII fields in any response | ✅ |

## Deployment note

Views (migration 042) are already applied to production D1. The API goes live with the next Pages deploy (bundle already synced). Production browser calls must use the Clerk admin session (secret fallback is blocked on `www.mildmate.com`).
