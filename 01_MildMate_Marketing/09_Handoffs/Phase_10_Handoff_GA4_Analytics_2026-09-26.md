# Phase 10 Handoff — GA4 Website Behavior & Funnel Analytics
Date: 2026-09-26  
Scope: Marketing Decision System Phase 10 only (GA4 ingestion + analysis + dashboard)

---

## 1) Outcome

Phase 10 is implemented in repository and ready for rollout:
- GA4 D1 schema + analysis views added.
- Token-auth GA4 ingestion API added under `/api/v1/ga4/*`.
- GA4 analysis endpoint added under `/api/admin/analysis/ga4`.
- Data Analyst dashboard now includes a GA4 Website Funnel section.
- `marketing-sync-worker` now includes weekly GA4 collector scheduling + manual/status endpoints.

Not yet operational in production until deployment + secrets + first live run are completed.

---

## 2) Files changed

### New
- `migrations/048_ga4_analytics.sql`
- `workers/api/ga4.ts`
- `01_MildMate_Marketing/09_Handoffs/Phase_10_Handoff_GA4_Analytics_2026-09-26.md`

### Updated
- `workers/api/index.ts`
- `functions/api/[[path]].ts`
- `functions/api/v1/[[path]].ts`
- `workers/api/admin-analysis.ts`
- `public/super-admin/marketing/data-analyst/index.html`
- `marketing-sync-worker/index.js`
- `marketing-sync-worker/wrangler.toml`
- `01_MildMate_Marketing/16_Phases/10_MildMate_Marketing_Decision_System_Phase_10_GA4_Checklist.md`

---

## 3) Schema / analytics additions

Migration: `048_ga4_analytics.sql`

### New table
- `ga4_funnel_daily` (daily grain with landing/page + source/medium/campaign/country/device dimensions)

### New views
- `analysis_ga4_daily`
- `analysis_ga4_page_daily`
- `analysis_ga4_product_daily`
- `analysis_ga4_product_28d`
- `analysis_ga4_freshness`

Key guardrail implemented:
- GA4 purchase revenue is isolated in GA4 views only and does not write or merge into canonical unified sales revenue facts.

---

## 4) API / routing additions

### New ingestion API
- `GET /api/v1/ga4/health`
- `POST /api/v1/ga4/rows/upsert`

Auth:
- Bearer token via existing `SALES_SYNC_API_TOKEN`.

### New admin analysis route
- `GET /api/admin/analysis/ga4?start&end&product_id`

Returns:
- summary funnel metrics
- 28d vs previous 28d trend
- top landing/page paths
- top source/medium
- freshness block

### Updated route dispatch
- `functions/api/v1/[[path]].ts`
- `functions/api/[[path]].ts`
- `workers/api/index.ts`

---

## 5) Collector additions (`marketing-sync-worker`)

### GA4 schedule
- Cron: `0 4 * * 1` (weekly Monday 04:00 UTC)

### GA4 manual/status endpoints
- `POST /ga4/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=2]`
- `GET /ga4/status`

### GA4 runtime behavior
- OAuth refresh token flow (`GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN`)
- Pulls GA4 Data API reports for:
  - sessions/users/engaged sessions
  - `view_item` (product views)
  - `add_to_cart`
  - `begin_checkout`
  - `purchase` (+ GA4 purchase revenue)
- Merges by daily dimension key and chunk-upserts to `/api/v1/ga4/rows/upsert`
- Uses dedicated GA4 lock stream (`ga4-weekly-sync`) to prevent overlap

---

## 6) Dashboard additions

Updated:
- `public/super-admin/marketing/data-analyst/index.html`

New card:
- **Website Funnel / GA4**
  - summary badges
  - 28d trend table
  - top landing/page table
  - top source/medium table

Data-quality API now also returns `ga4_freshness` block and warning logic.

---

## 7) Validation performed

1. JS syntax check:
- `node --check marketing-sync-worker/index.js` ✅

2. Pages Functions compile:
- `npx wrangler pages functions build --outfile <temp>` ✅

3. Local D1 migration apply + object verification:
- `npx wrangler d1 execute DB --local --file migrations/048_ga4_analytics.sql` ✅
- Verified table/views exist via `sqlite_master` query ✅

---

## 8) Remaining rollout steps (production)

1. Apply migration 048 on production D1.
2. Deploy updated Pages runtime.
3. Deploy updated `marketing-sync-worker`.
4. Set/verify worker secrets:
   - `GA4_CLIENT_ID`
   - `GA4_CLIENT_SECRET`
   - `GA4_REFRESH_TOKEN`
   - and var `GA4_PROPERTY_ID`
5. Run controlled manual collector test:
   - `POST /ga4/run?overlap=14`
6. Reconcile sampled GA4 date totals and directional purchase counts against source reports + unified sales.

---

## 9) Risks / open items

- GA4 metrics depend on property event instrumentation quality (especially `view_item`, `add_to_cart`, `begin_checkout`, `purchase` naming consistency).
- GA4 purchase numbers are attribution-based and must remain directional, not canonical order revenue.
- First live reconciliation is still required before marking this phase fully operational.
