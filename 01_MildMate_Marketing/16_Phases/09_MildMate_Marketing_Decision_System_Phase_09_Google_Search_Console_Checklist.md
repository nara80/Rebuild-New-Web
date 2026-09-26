# MildMate Marketing Decision System — Phase 09
## Google Search Console Analytics

**Project root:** `D:/00_Mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `feature/marketing-data-analyst`  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Existing Cloudflare Pages project  

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate


## Phase Goal

Add organic search demand and search visibility to the analytical system.

## Prerequisites / Confirmed Baseline

- [x] Phases 1–6 provide a stable Data Analyst framework.
- [x] Product/page identity rules are known.

## Task Checklist

- [x] Define GSC source grain: date + query + page + relevant dimensions.
- [x] Define D1 GSC fact table schema.
- [x] Define stable source uniqueness key.
- [x] Build authenticated ingestion endpoint.
- [x] Build weekly Cloudflare Worker GSC collector. *(implemented in `marketing-sync-worker` with OAuth refresh flow, overlap-window backfill, and scheduled weekly cron trigger.)*
- [x] Collect clicks.
- [x] Collect impressions.
- [x] Collect CTR.
- [x] Collect average position.
- [x] Preserve query and page identity.
- [x] Map MildMate product landing pages to Product_ID where defensible.
- [x] Keep non-product pages unmapped rather than forcing Product_ID.
- [x] Build GSC daily analytical views.
- [x] Build 28-day vs previous-28-day trend.
- [x] Add GSC freshness monitoring.
- [x] Add GSC section to Data Analyst dashboard.
- [x] Document metric limits and GSC aggregation caveats.

## Deliverables

- [x] GSC D1 fact table.
- [x] GSC scheduled collector Worker. *(weekly cron + manual run/status endpoints added in `marketing-sync-worker`.)*
- [x] GSC ingestion API.
- [x] GSC analytical views.
- [x] GSC Data Analyst section.

## Verification / Test Checklist

- [x] Collector retry is idempotent. *(upsert key + created/updated/unchanged/rejected accounting implemented in API logic)*
- [x] Date/query/page uniqueness works. *(UNIQUE key in migration 046 on report_date + query_norm + page_url + dimensions)*
- [x] Clicks/impressions are landing in production and trend metrics are queryable. *(verified 2026-09-26: production `gsc_search_daily` populated across multiple days with successful sync telemetry in `analysis_gsc_freshness`)*
- [x] Product URL mapping is correct. *(defensible mapping only for `/product/{slug}` and `/th/product/{slug}` paths)*
- [x] Non-product URLs are not falsely mapped.

## Definition of Done

- [x] Analyst can see which products/pages have rising or falling organic demand.
- [x] GSC data is fresh, auditable, and linked to Product_ID where defensible.

## Global Guardrails

- [!] Do not expose `SALES_SYNC_API_TOKEN` or any production secret.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not modify or replace the existing operational website `orders` system unless explicitly approved.
- [!] Do not count operational website `orders` together with unified `sales_orders`.
- [!] Do not invent historical line-item revenue.
- [!] `UNALLOCATED` revenue means unknown, not zero.
- [!] Do not equal-split multi-item order totals.
- [!] Do not expose unnecessary customer PII in marketing analytics.
- [!] Do not edit old production migrations; add a new migration when schema changes are required.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not build future phases early.


## Phase Handoff Rule

- [x] Record files changed.
- [x] Record migrations/API routes/UI routes created or changed.
- [x] Record tests performed and results.
- [x] Record unresolved issues and risks.
- [x] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [x] Commit only phase-scoped changes with a clear Git commit message.
- [x] Prepare a concise handoff for Phase 10 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 09 — Google Search Console Analytics`

## Droid Working Instruction

> Work on **Phase 09 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-26)

Status verified: **LIVE / OPERATIONAL**. Phase 09 is fully active in production. Migration `046_gsc_analytics.sql` objects are live, migration `047_gsc_freshness_sources.sql` is applied on production D1, `/api/v1/gsc/*` endpoints are reachable in deployed Pages runtime, and the `marketing-sync-worker` weekly cron collector is deployed with `GSC_REFRESH_TOKEN` configured. Manual production runs succeeded and populated real GSC data (`gsc_search_daily`), while freshness telemetry reports successful sync status.
