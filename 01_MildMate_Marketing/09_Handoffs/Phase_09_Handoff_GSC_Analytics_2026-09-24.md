# MildMate Marketing Decision System — Phase 09 Handoff
## Google Search Console Analytics

**Date:** 2026-09-25  
**Status:** Phase 09 infrastructure deployed; weekly Cloudflare collector implemented in repo, awaiting worker deploy + first live ingest/reconciliation

---

## 1) Scope completed in this phase

Built the Phase 09 GSC analytics layer end-to-end in code:

- D1 schema + analytical views (migration 046)
- Freshness-source update migration (047)
- Authenticated ingestion API (`/api/v1/gsc/*`)
- Weekly Cloudflare collector in `marketing-sync-worker` (OAuth refresh + overlap window + cron/manual run)
- Admin analysis read endpoint (`GET /api/admin/analysis/gsc`)
- Data-quality GSC freshness block (`gsc_freshness`)
- Data Analyst dashboard GSC section (summary + trend + top pages + top queries)

Guardrails preserved:
- No renumbering of canonical product IDs
- Non-product URLs remain unmapped
- No secret exposure

---

## 2) Files changed

- `migrations/046_gsc_analytics.sql` **(new)**
- `migrations/047_gsc_freshness_sources.sql` **(new)**
- `workers/api/gsc.ts` **(new)**
- `workers/api/admin-analysis.ts`
- `workers/api/index.ts`
- `functions/api/[[path]].ts`
- `public/super-admin/marketing/data-analyst/index.html`
- `public/_worker.js` (rebuilt)
- `public/index.js` (rebuilt)
- `marketing-sync-worker/index.js`
- `marketing-sync-worker/wrangler.toml`
- `01_MildMate_Marketing/04_API/Phase_04_Analysis_API_Reference_2026-09-07.md`
- `01_MildMate_Marketing/16_Phases/09_MildMate_Marketing_Decision_System_Phase_09_Google_Search_Console_Checklist.md`

---

## 3) Migration and data model

### `046_gsc_analytics.sql`

Adds:
- Table: `gsc_search_daily`
  - Grain: `report_date + query_norm + page_url + country + device + search_type + search_appearance`
  - Metrics: `clicks`, `impressions`, `ctr`, `position`
  - Mapping: nullable `product_id` + `mapping_scope`
- Views:
  - `analysis_gsc_daily`
  - `analysis_gsc_page_daily`
  - `analysis_gsc_product_daily`
  - `analysis_gsc_product_28d`
  - `analysis_gsc_freshness`

Identity + idempotency guardrail:
- UNIQUE key enforces stable source uniqueness at GSC row grain.

### `047_gsc_freshness_sources.sql`

Updates `analysis_gsc_freshness` to read sync health from any `sync_runs.source LIKE 'gsc-%'`, so freshness works for both legacy/manual source names and the new weekly Cloudflare collector source (`gsc-worker-cron`).

---

## 4) API routes added/updated

### Ingestion (token-auth)
- `GET /api/v1/gsc/health`
- `POST /api/v1/gsc/rows/upsert`

Handler:
- `workers/api/gsc.ts` via `functions/api/[[path]].ts` routing
- Auth: Bearer token (`SALES_SYNC_API_TOKEN`)
- Sync telemetry written to `sync_runs` (collector now posts with `sync_source = gsc-worker-cron`)
- Upsert counters: created / updated / unchanged / rejected

### Collector runtime (Cloudflare Worker)
- `marketing-sync-worker` now includes GSC collector paths:
  - Scheduled weekly cron trigger (`0 3 * * 1`)
  - `POST /gsc/run` (manual run, optional `start/end/overlap/lag`)
  - `GET /gsc/status` (freshness + lock + recent GSC sync runs)

### Admin analysis
- `GET /api/admin/analysis/gsc`
  - Returns summary, 28d-vs-previous trend, freshness, top pages, top queries.
- `GET /api/admin/analysis/data-quality`
  - Extended with `gsc_freshness` block.
  - If migration 046 is absent in an environment, endpoint still works for sales analytics and reports `available=false`.

---

## 5) Dashboard updates

Updated `public/super-admin/marketing/data-analyst/index.html`:

- Added **SEO / Google Search Console** card with:
  - KPI badges (clicks, impressions, CTR, avg position, query/page counts, mapped coverage)
  - 28d vs previous 28d table
  - Top landing pages table
  - Top queries table
- Integrated loader into orchestration (`loadAll`, `applyFilters`)
- Degrades gracefully when schema is unavailable or no data exists

---

## 6) Tests/validation performed

1. **Bundle compile/rebuild**
   - `powershell -File .\extract-worker.ps1`
   - Additional wrangler build extraction to `public/index.js`
   - `node --check public/_worker.js`
   - `node --check public/index.js`

2. **Migration validation (local D1)**
   - `npx wrangler d1 execute DB --local --file migrations/046_gsc_analytics.sql`
   - All commands executed successfully.

3. **Schema object smoke check (local D1)**
   - Verified `gsc_search_daily` + all 5 `analysis_gsc_*` views exist in `sqlite_master`.

4. **Dashboard script syntax check**
   - Parsed inline scripts and validated with `new Function(...)`.
   - Both inline script blocks parsed successfully.

5. **Collector worker validation**
   - `node --check marketing-sync-worker/index.js`
   - `wrangler deploy --dry-run` in `marketing-sync-worker` succeeded (bindings/crons resolved).

6. **Freshness migration validation (local D1)**
   - `npx wrangler d1 execute DB --local --file migrations/047_gsc_freshness_sources.sql`
   - Verified `analysis_gsc_freshness` now filters `sync_runs` with `source LIKE 'gsc-%'`.

---

## 7) Known limitations / remaining external steps

1. **Worker deploy + secrets step pending**:
   - Deploy updated `marketing-sync-worker` and set `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN` (plus confirm `GSC_SITE_URL`).

2. **Migration 047 apply pending on remote D1**:
   - Required so `analysis_gsc_freshness` tracks `gsc-worker-cron` runs.

3. **Live reconciliation pending**:
   - Clicks/impressions must be cross-checked against sampled GSC reports after first live ingest.

---

## 8) Phase 10 handoff note

Phase 10 (GA4) can reuse the same pattern:
- Add `ga4_*` fact table + `analysis_ga4_*` views by migration
- Add token-auth ingestion endpoint under `/api/v1/ga4/*`
- Add `/api/admin/analysis/ga4` read endpoint
- Extend dashboard with GA4 section and freshness monitor
