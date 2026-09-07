# MildMate Marketing Decision System — Phase 13
## Profitability & Contribution Margin Layer

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

Move decision-making from revenue growth to profitable growth.

## Prerequisites / Confirmed Baseline

- [x] Sales and paid-media data sufficiently stable.
- [x] Business agrees that cost inputs may include controlled estimates where clearly labelled.

## Task Checklist

- [ ] Define source of truth for production cost.
- [ ] Define shipping-cost methodology.
- [ ] Define marketplace fee methodology.
- [ ] Define payment fee methodology.
- [ ] Define advertising-cost attribution basis.
- [ ] Define whether costs vary by product, size, fabric, market, or date.
- [ ] Add effective-date handling for changing costs if needed.
- [ ] Create controlled cost tables/fields.
- [ ] Separate exact costs from estimates.
- [ ] Calculate gross margin where possible.
- [ ] Calculate contribution margin.
- [ ] Calculate contribution profit.
- [ ] Calculate contribution after advertising where appropriate.
- [ ] Add confidence/coverage for profitability metrics.
- [ ] Build profitability analytical views.
- [ ] Add profitability section to Data Analyst dashboard.
- [ ] Document all assumptions.

## Deliverables

- [ ] Cost model.
- [ ] Profitability D1 schema.
- [ ] Contribution-margin calculations.
- [ ] Profitability dashboard.

## Verification / Test Checklist

- [ ] Known order/product examples manually reconcile.
- [ ] Estimated cost is visibly labelled.
- [ ] Missing cost does not silently become zero.
- [ ] Fee calculations use correct effective dates.
- [ ] Ad spend is not double-counted.

## Definition of Done

- [ ] System can distinguish high-revenue from high-contribution opportunities.
- [ ] Budget decisions can use profitability, not only ROAS/revenue.

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
- [ ] Prepare a concise handoff for Phase 14 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 13 — Profitability & Contribution Margin Layer`

## Droid Working Instruction

> Work on **Phase 13 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
