# MildMate Marketing Decision System — Phase 12
## Paid Media Analytics — Google Ads & Meta Ads

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

Add spend, acquisition efficiency, and paid-channel performance.

## Prerequisites / Confirmed Baseline

- [x] Core sales, product, GSC/GA4/Etsy analytical patterns established.

## Task Checklist

- [ ] Define Google Ads fact-table grain.
- [ ] Define Meta Ads fact-table grain.
- [ ] Preserve campaign/ad group/ad identifiers.
- [ ] Collect spend.
- [ ] Collect impressions.
- [ ] Collect clicks.
- [ ] Collect conversions.
- [ ] Collect conversion value with source definition.
- [ ] Build Google Ads ingestion endpoint/collector.
- [ ] Build Meta Ads ingestion endpoint/collector.
- [ ] Define campaign → product mapping where defensible.
- [ ] Keep non-product campaigns unassigned rather than forcing Product_ID.
- [ ] Calculate CPA.
- [ ] Calculate ROAS using clearly defined revenue basis.
- [ ] Keep platform-attributed revenue separate from canonical D1 order revenue.
- [ ] Build paid-media analytical views.
- [ ] Add Paid Media section to Data Analyst dashboard.
- [ ] Add source freshness and collector-error monitoring.

## Deliverables

- [ ] Google Ads fact table + collector.
- [ ] Meta Ads fact table + collector.
- [ ] Paid media analytical views.
- [ ] Paid Media dashboard.

## Verification / Test Checklist

- [ ] Spend matches source reports.
- [ ] Campaign IDs remain stable through name changes.
- [ ] Product mapping does not force ambiguous campaigns.
- [ ] CPA/ROAS definitions are documented.
- [ ] Platform revenue is not double-counted as canonical sales.

## Definition of Done

- [ ] Analyst can compare paid spend and acquisition efficiency while preserving source attribution boundaries.

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
- [ ] Prepare a concise handoff for Phase 13 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 12 — Paid Media Analytics — Google Ads & Meta Ads`

## Droid Working Instruction

> Work on **Phase 12 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
