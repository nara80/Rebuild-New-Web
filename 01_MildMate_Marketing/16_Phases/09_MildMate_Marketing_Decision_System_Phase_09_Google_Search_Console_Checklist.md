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
- [ ] Build Make.com GSC collector. *(API contract + payload shape are ready; Make scenario wiring in the user account is still operator-side.)*
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
- [ ] GSC Make collector. *(operator-side Make.com scenario still pending)*
- [x] GSC ingestion API.
- [x] GSC analytical views.
- [x] GSC Data Analyst section.

## Verification / Test Checklist

- [x] Collector retry is idempotent. *(upsert key + created/updated/unchanged/rejected accounting implemented in API logic)*
- [x] Date/query/page uniqueness works. *(UNIQUE key in migration 046 on report_date + query_norm + page_url + dimensions)*
- [ ] Clicks/impressions reconcile to sampled GSC reports. *(pending first live collector run)*
- [x] Product URL mapping is correct. *(defensible mapping only for `/product/{slug}` and `/th/product/{slug}` paths)*
- [x] Non-product URLs are not falsely mapped.

## Definition of Done

- [ ] Analyst can see which products/pages have rising or falling organic demand. *(UI + API are ready; awaits live GSC ingestion.)*
- [ ] GSC data is fresh, auditable, and linked to Product_ID where defensible. *(schema/API complete; freshness depends on first live sync.)*

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

## Reconciliation Note (2026-09-19)

Status update (2026-09-25): **DEPLOYED (infrastructure live), data onboarding pending**. Migration `046_gsc_analytics.sql` is now applied on remote D1 (`mildmate-db-prod`), and Pages deployment includes the Phase 09 runtime/dashboard updates (deployment URL observed: `https://31c3cbc3.mildmate-new.pages.dev`). Remaining external/live items are Make.com scenario wiring and first live reconciliation against sampled GSC reports.
