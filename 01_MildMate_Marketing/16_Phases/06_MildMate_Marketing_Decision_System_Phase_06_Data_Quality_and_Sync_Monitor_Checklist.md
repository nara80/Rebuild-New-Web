# MildMate Marketing Decision System — Phase 06
## Data Quality & Sync Monitor

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

Make data reliability visible before using the data for marketing decisions.

## Prerequisites / Confirmed Baseline

- [x] Phase 5 Data Analyst MVP working.

## Task Checklist

- [ ] Surface latest successful sales sync from `sync_runs` or verified equivalent.
- [ ] Show sync freshness/status.
- [ ] Show mapped order/item percentage.
- [ ] Show unmapped order/item count.
- [ ] Show EXACT vs UNALLOCATED coverage.
- [ ] Show missing Product_ID count.
- [ ] Show unexpected/unknown source labels.
- [ ] Show orders with no active items.
- [ ] Show suspicious null/zero totals where business rules say they are invalid.
- [ ] Show recent API/sync errors if available.
- [ ] Define severity levels: OK / Warning / Critical.
- [ ] Create human-readable explanations for each alert.
- [ ] Add drill-down to affected records where safe.
- [ ] Add source freshness by channel where available.
- [ ] Document acceptable freshness thresholds.
- [ ] Add data-quality status to the main Data Analyst header.

## Deliverables

- [ ] Data Quality section/page.
- [ ] Sync health indicators.
- [ ] Exception lists.
- [ ] Severity rules.

## Verification / Test Checklist

- [ ] Simulate/locate a stale sync case.
- [ ] Simulate/locate a missing Product_ID case.
- [ ] Verify unmapped counts.
- [ ] Verify EXACT/UNALLOCATED percentages.
- [ ] Verify no false critical state when data is valid.

## Definition of Done

- [ ] Analyst can determine whether the data is trustworthy before making decisions.
- [ ] Major quality problems are visible without SQL.

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
- [ ] Prepare a concise handoff for Phase 7 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 06 — Data Quality & Sync Monitor`

## Droid Working Instruction

> Work on **Phase 06 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
