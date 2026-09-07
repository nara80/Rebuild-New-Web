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

- [ ] Define GSC source grain: date + query + page + relevant dimensions.
- [ ] Define D1 GSC fact table schema.
- [ ] Define stable source uniqueness key.
- [ ] Build authenticated ingestion endpoint.
- [ ] Build Make.com GSC collector.
- [ ] Collect clicks.
- [ ] Collect impressions.
- [ ] Collect CTR.
- [ ] Collect average position.
- [ ] Preserve query and page identity.
- [ ] Map MildMate product landing pages to Product_ID where defensible.
- [ ] Keep non-product pages unmapped rather than forcing Product_ID.
- [ ] Build GSC daily analytical views.
- [ ] Build 28-day vs previous-28-day trend.
- [ ] Add GSC freshness monitoring.
- [ ] Add GSC section to Data Analyst dashboard.
- [ ] Document metric limits and GSC aggregation caveats.

## Deliverables

- [ ] GSC D1 fact table.
- [ ] GSC Make collector.
- [ ] GSC ingestion API.
- [ ] GSC analytical views.
- [ ] GSC Data Analyst section.

## Verification / Test Checklist

- [ ] Collector retry is idempotent.
- [ ] Date/query/page uniqueness works.
- [ ] Clicks/impressions reconcile to sampled GSC reports.
- [ ] Product URL mapping is correct.
- [ ] Non-product URLs are not falsely mapped.

## Definition of Done

- [ ] Analyst can see which products/pages have rising or falling organic demand.
- [ ] GSC data is fresh, auditable, and linked to Product_ID where defensible.

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

- [ ] Record files changed.
- [ ] Record migrations/API routes/UI routes created or changed.
- [ ] Record tests performed and results.
- [ ] Record unresolved issues and risks.
- [ ] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [ ] Prepare a concise handoff for Phase 10 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 09 — Google Search Console Analytics`

## Droid Working Instruction

> Work on **Phase 09 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
