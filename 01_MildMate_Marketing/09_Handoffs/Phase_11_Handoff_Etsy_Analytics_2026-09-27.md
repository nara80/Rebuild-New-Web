# Phase 11 Handoff — Etsy Listing & Performance Analytics
Date: 2026-09-27  
Scope: Marketing Decision System Phase 11 only (Etsy listing analytics ingestion + analysis + dashboard)

---

## 1) Outcome

Phase 11 is implemented in repository and ready for rollout:
- Etsy listing master + daily fact D1 schema added.
- Token-auth Etsy ingestion API added under `/api/v1/etsy/*`.
- Etsy analysis endpoint added under `/api/admin/analysis/etsy`.
- Data Analyst dashboard now includes a Marketplace / Etsy section.
- Data Quality endpoint now includes Etsy freshness monitoring.
- `marketing-sync-worker` now includes Etsy cron collector scheduling + manual/status endpoints.

Implementation choice for this phase:
- Supports both:
  - **approved structured import path** (`/api/v1/etsy/rows/upsert`)
  - **Worker cron collector path** (`marketing-sync-worker` → `/etsy/run`, `/etsy/status`, scheduled weekly trigger)

Not yet operational in production until deployment + first live ingest/reconciliation are completed.

---

## 2) Files changed

### New
- `migrations/049_etsy_analytics.sql`
- `workers/api/etsy.ts`
- `01_MildMate_Marketing/09_Handoffs/Phase_11_Handoff_Etsy_Analytics_2026-09-27.md`

### Updated
- `workers/api/index.ts`
- `functions/api/[[path]].ts`
- `functions/api/v1/[[path]].ts`
- `workers/api/admin-analysis.ts`
- `public/super-admin/marketing/data-analyst/index.html`
- `public/_worker.js` (rebuilt)
- `public/index.js` (rebuilt)
- `marketing-sync-worker/index.js`
- `marketing-sync-worker/wrangler.toml`
- `01_MildMate_Marketing/16_Phases/11_MildMate_Marketing_Decision_System_Phase_11_Etsy_Performance_Checklist.md`

---

## 3) Schema / analytics additions

Migration: `049_etsy_analytics.sql`

### New tables
- `etsy_listing_master`
  - durable Etsy listing identity (`listing_id`) + metadata
  - active/inactive status persistence
  - canonical mapping to `products.id` (`product_id`, nullable)
- `etsy_listing_daily`
  - daily listing metrics fact table
  - metrics: visits, views, favorites, orders, transactions, units_sold, revenue, revenue_thb
  - idempotent uniqueness at `(report_date, listing_id, currency)`

### New views
- `analysis_etsy_daily`
- `analysis_etsy_listing_daily`
- `analysis_etsy_product_daily`
- `analysis_etsy_product_28d`
- `analysis_etsy_listing_status`
- `analysis_etsy_freshness`

Freshness view tracks `sync_runs` with `source LIKE 'etsy-%'`.

---

## 4) API / routing additions

### New ingestion API
- `GET /api/v1/etsy/health`
- `POST /api/v1/etsy/rows/upsert`

Auth:
- Bearer token via existing `SALES_SYNC_API_TOKEN`.

Behavior:
- Upserts listing master + daily fact in one pass.
- Reuses existing mapping memory (`product_mapping_aliases`) for deterministic listing-level mapping.
- Supports multiple listings per one canonical `Product_ID`.
- Preserves inactive listing identities in master.
- Writes run telemetry to `sync_runs`.

### New admin analysis route
- `GET /api/admin/analysis/etsy?start&end&product_id`

Returns:
- summary metrics
- 28d vs previous 28d trend
- listing status snapshot (active/inactive + mapped/unmapped + state breakdown)
- top listings
- top mapped products
- freshness block

### Updated route dispatch
- `workers/api/index.ts`
- `functions/api/[[path]].ts`
- `functions/api/v1/[[path]].ts`

### Collector runtime (`marketing-sync-worker`)
- Scheduled cron:
  - shared with GA4 at `0 4 * * 1` (weekly Monday 04:00 UTC)
- Manual/status endpoints:
  - `POST /etsy/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=1]`
  - `GET /etsy/status`
- Sync source telemetry:
  - `sync_runs.source = etsy-worker-cron` (matches `analysis_etsy_freshness` pattern `source LIKE 'etsy-%'`)
- Collector behavior:
  - refreshes Etsy OAuth token from secrets
  - fetches listings across states (`active|inactive|sold_out|draft|removed|expired`) to preserve inactive identities
  - fetches paid receipts in window and aggregates listing-level orders/transactions/units/revenue
  - upserts rows to `/api/v1/etsy/rows/upsert` in chunks

---

## 5) Dashboard additions

Updated:
- `public/super-admin/marketing/data-analyst/index.html`

New card:
- **Marketplace / Etsy**
  - summary badges
  - 28d trend table
  - listing status snapshot
  - top listings table
  - top products table

Orchestration updated:
- `loadAll()` and `applyFilters()` now include Etsy loading flow.

---

## 6) Validation performed

1. **Pages Functions compile**
   - `npx wrangler pages functions build --outfile <temp>` ✅

2. **Migration validation (local D1)**
   - `npx wrangler d1 execute DB --local --file migrations/049_etsy_analytics.sql` ✅

3. **Schema object verification (local D1)**
   - Queried `sqlite_master` and verified:
     - `etsy_listing_master`, `etsy_listing_daily`
     - all `analysis_etsy_*` views ✅

4. **Dashboard script syntax check**
   - Extracted inline `<script>` blocks and checked with `node --check` ✅

5. **Runtime bundle rebuild + syntax**
   - Rebuilt `public/_worker.js` and `public/index.js` from Pages Functions build output ✅
   - `node --check public/_worker.js` ✅
   - `node --check public/index.js` ✅

6. **Collector worker validation**
   - `node --check marketing-sync-worker/index.js` ✅
   - `wrangler deploy --dry-run` in `marketing-sync-worker` ✅

---

## 7) Remaining rollout steps (production)

1. Apply migration 049 on production D1.
2. Deploy updated Pages runtime.
3. Deploy updated `marketing-sync-worker`.
4. Run controlled collector test:
   - `POST /etsy/run?overlap=14`
5. Reconcile sampled listing metrics and revenue/order definitions against Etsy source exports/API.
6. Confirm data freshness warnings remain healthy after first live run.

---

## 8) Risks / open items

- Revenue reconciliation remains pending first live ingest (source-definition validation).
- Listing-to-product mapping quality still depends on deterministic mapping memory (explicit `product_id` or verified listing alias rows).
- If source payloads omit THB conversion, `revenue_thb` can be null unless provided directly or with exchange rate in payload.

---

## 9) Phase 12 handoff note

Phase 12 (Paid Media) should reuse this same pattern:
- add dedicated paid-media fact schema + `analysis_*` views via new migration,
- add token-auth ingestion endpoint(s) under `/api/v1/*`,
- add read endpoint(s) under `/api/admin/analysis/*`,
- extend Data Analyst dashboard with freshness + source-definition caveats,
- keep paid-media spend/revenue directional and never overwrite canonical sales facts.
