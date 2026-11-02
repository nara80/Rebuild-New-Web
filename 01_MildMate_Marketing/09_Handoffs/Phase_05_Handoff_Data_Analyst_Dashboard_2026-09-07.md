# Phase 05 Handoff — Data Analyst Dashboard MVP

**Date:** 2026-09-07
**Branch:** `feature/marketing-data-analyst`
**Status:** ✅ Built + locally verified. Not yet deployed to production (deploys together with Phase 04 on next Pages deploy).

## What was delivered

### 1. Dashboard page — `public/super-admin/marketing/data-analyst/index.html` (NEW)

Self-contained page (inline CSS + vanilla JS, no build step) at `/super-admin/marketing/data-analyst/`, consuming only the Phase 04 read-only API (`/api/admin/analysis/*`).

- **8 KPI cards:** Commercial Orders, Order Revenue (THB), Units, AOV, Mapped Orders %, Unallocated Items % (with "unknown ≠ zero" note), Last Sales Sync, Data Quality status.
- **Data Quality banner:** ok/warning/critical with the API's plain-language warning list; freshness badge in the toolbar (`sync: N min/hr ago`, green/amber/red).
- **Filters:** date range, channel (populated from `/channels`), product (populated from `/products`, shows `#ID — title`), order status, mapping status, revenue status. Dates/channel apply to KPIs + all tables; product/status/mapping/revenue apply to Sales Detail.
- **3 tables:** Sales Detail (paginated 25/page, prev/next, Product_ID visible, EXACT/UNALLOCATED and Mapped/Partial/Unmapped badges), Product Participation (Product_ID, orders, units, top channel, 28d trend, exact revenue, revenue coverage %), Channel Analysis (orders, revenue, units, AOV, mapped %).
- **States:** loading, per-section empty ("No … for the selected filters"), per-section API error (message shown, other sections unaffected).
- **Contract compliance:** UNALLOCATED renders as "—", never 0; footer notes the Metric Contract and commercial-status definition. No PII anywhere on the page.
- **Responsive:** KPI grid 4 → 2 → 1 columns; tables horizontally scrollable on narrow screens.

### 2. Auth

- **Server-side:** the existing `functions/super-admin/_middleware.ts` (re-export of admin middleware) already covers `/super-admin/marketing/data-analyst/` — Clerk `__session` cookie required on production hosts, dev bypass on `pages.dev`/`localhost` (same as the SPA).
- **Client-side:** page loads `/js/clerk.js`, waits up to 10 s for `window.clerk.session`; if absent shows a sign-in gate pointing to `/super-admin/`. API calls send Clerk Bearer token, with `localStorage.admin_secret` → `X-Admin-Secret` as the dev fallback (never accepted on production hosts, per Phase 04 auth).

### 3. Navigation

`public/super-admin/index.html` → Marketing tab bar now includes a fourth entry: **📊 Data Analyst** (plain link to `/super-admin/marketing/data-analyst/`, alongside Run a Sale / Send Offers / Promo Codes).

### 4. API addition — `mapping` filter on sales endpoint

`workers/api/admin-analysis.ts`: `GET /sales` now accepts `mapping=Mapped|Partial|Unmapped|Itemless` (case-insensitive, validated, filters `analysis_order_mapping.derived_mapping_status`; 400 `INVALID_MAPPING_STATUS` otherwise). Runtime bundles rebuilt and synced (`public/_worker.js` = `public/index.js` = 613,222 bytes). API reference updated.

## Verification (local: `wrangler pages dev public` + seeded local D1)

| Check | Result |
|---|---|
| Page loads via dev bypass, gate hidden, app rendered | ✅ 200, KPIs populated |
| Unauthenticated request to page on non-bypass host | ✅ redirected to Clerk sign-in (middleware) |
| Unauthenticated API call | ✅ 401 |
| `mapping=bogus` | ✅ 400 |
| Mapping totals partition: all 9 = Mapped 7 + Partial 2 + Unmapped 0; lowercase `mapped` accepted | ✅ |
| KPIs match analytical layer (7 orders, ฿16,754, 11 units, AOV ฿2,393.43, mapped 85.7%, unallocated 77.8%) | ✅ matches Phase 03 §9 |
| Channel filter (shopee): KPIs 4 orders / ฿7,174, sales 1–4 of 4 — matches Channel Analysis row | ✅ |
| Mapping filter (Partial): sales 1–2 of 2 | ✅ |
| Empty period (2020-01): orders 0, AOV "—", clean empty states in tables | ✅ |
| DQ banner: WARNING with freshness + missing-Product_ID warnings (expected — Make.com sync not yet on schedule) | ✅ |
| Desktop 1440px + mobile 390px screenshots reviewed | ✅ 4-col grid / single-column stack |
| SPA Marketing tab shows Data Analyst link with correct href | ✅ |

## Deploy

Nothing from Phase 04 or 05 is live until the next Pages deploy (user-triggered):

```powershell
npx wrangler pages deploy public --project-name=mildmate-new
```

Post-deploy verification: sign in as super admin → `/super-admin/` → Marketing → 📊 Data Analyst → KPIs load and DQ banner shows (expect WARNING until the sync schedule is activated). An account not in the allowlist must be redirected/denied.

## Known limitations / next phases

- 28d trend shows "n/a" until there is order history inside the current 28-day window.
- Product drill-down endpoint (`/product/:id`) is not yet surfaced in the UI (candidate for Phase 06 opportunity/drill-down work).
- Channel filter options come from all-time channels, not the filtered period (harmless superset).
- Freshness stays WARNING until the Make.com scenario is activated on its 15-minute schedule.
