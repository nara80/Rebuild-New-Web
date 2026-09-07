# MildMate Marketing Decision System — Phase 03
## D1 Sales Analytical Layer

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

Create reusable D1 analytical views/tables so the UI and APIs do not repeatedly reconstruct business logic.

## Prerequisites / Confirmed Baseline

- [x] Phase 2 Metric Contract approved.
- [x] Existing D1 unified sales data model verified.

## Task Checklist

- [ ] Confirm current latest migration number before creating a new migration.
- [ ] Choose SQL VIEW vs summary table for each analytical object.
- [ ] Prefer SQL views initially unless performance requires materialized summary tables.
- [ ] Create `analysis_sales_daily`.
- [ ] Create `analysis_product_participation`.
- [ ] Create `analysis_product_channel`.
- [ ] Create `analysis_sales_28d`.
- [ ] Create `analysis_sales_90d`.
- [ ] Create `analysis_data_quality`.
- [ ] Apply commercial/test/cancelled exclusion rules from Phase 2.
- [ ] Count unique orders correctly.
- [ ] Handle multi-item orders correctly.
- [ ] Aggregate exact product revenue only where `revenue_status = EXACT`.
- [ ] Keep UNALLOCATED product line revenue out of exact product-revenue sums.
- [ ] Join products using permanent `products.id`.
- [ ] Expose product title only as descriptive metadata, not identity.
- [ ] Validate channel normalization.
- [ ] Validate zero/null handling.
- [ ] Add indexes only if justified by actual query plans and workload.
- [ ] Run local/staging migration.
- [ ] Run representative analytical queries.
- [ ] Document query semantics and expected output.

## Deliverables

- [ ] New migration file.
- [ ] Analytical SQL objects.
- [ ] Sample query results.
- [ ] Technical documentation for each analytical object.

## Verification / Test Checklist

- [ ] Unique order counting.
- [ ] Multi-item order handling.
- [ ] EXACT revenue aggregation.
- [ ] UNALLOCATED revenue exclusion from exact product revenue.
- [ ] Test-order exclusion.
- [ ] Cancelled/non-commercial exclusion.
- [ ] Multiple channels.
- [ ] Empty date periods.
- [ ] Missing Product_ID behavior.
- [ ] 28-day and 90-day boundary checks.

## Definition of Done

- [ ] D1 can answer core sales-analysis questions without custom ad hoc SQL each time.
- [ ] All analytical objects match the approved Metric Contract.
- [ ] Tests pass in local/staging.
- [ ] No production deployment yet unless separately approved.

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
- [ ] Prepare a concise handoff for Phase 4 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 03 — D1 Sales Analytical Layer`

## Droid Working Instruction

> Work on **Phase 03 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
