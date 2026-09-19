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

- [x] Confirm current latest migration number before creating a new migration.
- [x] Choose SQL VIEW vs summary table for each analytical object.
- [x] Prefer SQL views initially unless performance requires materialized summary tables.
- [x] Create `analysis_sales_daily`.
- [x] Create `analysis_product_participation`.
- [x] Create `analysis_product_channel`.
- [x] Create `analysis_sales_28d`.
- [x] Create `analysis_sales_90d`.
- [x] Create `analysis_data_quality`.
- [x] Apply commercial/test/cancelled exclusion rules from Phase 2.
- [x] Count unique orders correctly.
- [x] Handle multi-item orders correctly.
- [x] Aggregate exact product revenue only where `revenue_status = EXACT`.
- [x] Keep UNALLOCATED product line revenue out of exact product-revenue sums.
- [x] Join products using permanent `products.id`.
- [x] Expose product title only as descriptive metadata, not identity.
- [x] Validate channel normalization.
- [x] Validate zero/null handling.
- [x] Add indexes only if justified by actual query plans and workload.
- [x] Run local/staging migration.
- [x] Run representative analytical queries.
- [x] Document query semantics and expected output.

## Deliverables

- [x] New migration file.
- [x] Analytical SQL objects.
- [x] Sample query results.
- [x] Technical documentation for each analytical object.

## Verification / Test Checklist

- [x] Unique order counting.
- [x] Multi-item order handling.
- [x] EXACT revenue aggregation.
- [x] UNALLOCATED revenue exclusion from exact product revenue.
- [x] Test-order exclusion.
- [x] Cancelled/non-commercial exclusion.
- [x] Multiple channels.
- [x] Empty date periods.
- [x] Missing Product_ID behavior.
- [x] 28-day and 90-day boundary checks.

## Definition of Done

- [x] D1 can answer core sales-analysis questions without custom ad hoc SQL each time.
- [x] All analytical objects match the approved Metric Contract.
- [x] Tests pass in local/staging.
- [x] No production deployment yet unless separately approved.

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
- [x] Prepare a concise handoff for Phase 4 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 03 — D1 Sales Analytical Layer`

## Droid Working Instruction

> Work on **Phase 03 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-19)

Every task, deliverable, verification, and handoff item above was completed during the 2026-09-07 build session; this checklist was not updated at the time. Verified 2026-09-19:
- Migration `migrations/042_marketing_analysis_layer.sql` defines exactly **10 views** (not 11 as some docs previously stated): analysis_commercial_orders, analysis_active_items, analysis_order_mapping, analysis_sales_daily, analysis_product_participation, analysis_product_channel, analysis_sales_28d, analysis_sales_90d, analysis_product_copurchase, analysis_data_quality.
- All 10 views confirmed live in production D1 `mildmate-db-prod` via `sqlite_master` query on 2026-09-19.
- No indexes were added (rule "only if justified by query plans" — none justified to date; views run against tables of ~493 orders / 737 items).
- Semantics validated end-to-end by the Phase 08 backfill reconciliation (493 orders, ฿1,552,277.63, 0 unmapped items, 737/737 UNALLOCATED — exact product revenue correctly empty).
- Handoff exists: `09_Handoffs/Phase_03_Handoff_D1_Analytical_Layer_2026-09-07.md`.
