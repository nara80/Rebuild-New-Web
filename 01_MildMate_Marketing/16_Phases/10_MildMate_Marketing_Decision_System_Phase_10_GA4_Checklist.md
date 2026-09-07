# MildMate Marketing Decision System — Phase 10
## GA4 Website Behavior & Funnel Analytics

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

Add website traffic and funnel behavior to product/channel analysis.

## Prerequisites / Confirmed Baseline

- [x] GSC framework patterns established or equivalent collector conventions approved.
- [x] GA4 property/tracking verified enough for analysis.

## Task Checklist

- [ ] Define GA4 dimensions and metrics required for decisions.
- [ ] Define daily fact-table grain.
- [ ] Collect sessions.
- [ ] Collect landing-page sessions.
- [ ] Collect product views where available.
- [ ] Collect add-to-cart events.
- [ ] Collect checkout events.
- [ ] Collect purchases/conversions.
- [ ] Map product page path/identity to Product_ID.
- [ ] Preserve campaign/source/medium dimensions where useful.
- [ ] Build authenticated ingestion endpoint.
- [ ] Build Make.com GA4 collector.
- [ ] Build GA4 analytical views.
- [ ] Build funnel metrics by product/channel where defensible.
- [ ] Do not double-count GA4 purchase revenue as canonical sales revenue.
- [ ] Reconcile purchase counts directionally with unified sales.
- [ ] Add GA4 freshness monitoring.
- [ ] Add Website Funnel section to Data Analyst dashboard.

## Deliverables

- [ ] GA4 D1 fact table.
- [ ] GA4 collector.
- [ ] GA4 analysis views.
- [ ] Website funnel dashboard.

## Verification / Test Checklist

- [ ] Known date totals match GA4 reports within documented definitions.
- [ ] Product path mapping works.
- [ ] Purchase events are not added to canonical order revenue.
- [ ] Missing event data is shown as unavailable rather than zero where appropriate.

## Definition of Done

- [ ] Analyst can compare traffic, product interest, funnel behavior, and purchases without contaminating canonical sales facts.

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
- [ ] Prepare a concise handoff for Phase 11 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 10 — GA4 Website Behavior & Funnel Analytics`

## Droid Working Instruction

> Work on **Phase 10 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
