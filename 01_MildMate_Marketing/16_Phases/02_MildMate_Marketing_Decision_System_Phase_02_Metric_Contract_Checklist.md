# MildMate Marketing Decision System — Phase 02
## Metric Contract & Analytical Data Design

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

Define exactly what every sales and data-quality metric means before implementing analytics.

## Prerequisites / Confirmed Baseline

- [x] Phase 1 architecture audit approved.
- [x] `sales_orders`, `sales_order_items`, `sync_runs`, and `products` schemas verified.

## Task Checklist

- [x] Define Commercial Order Count.
- [x] Define Order Revenue.
- [x] Define Units.
- [x] Define Average Order Value.
- [x] Define Orders Containing Product.
- [x] Define Product Quantity.
- [x] Define Exact Product Revenue.
- [x] Define Product Attach Rate.
- [x] Define Product Co-Purchase Rate.
- [x] Define Orders by Channel.
- [x] Define Revenue by Channel.
- [x] Define Mapped Order %.
- [x] Define Mapped Item % if useful.
- [x] Define Exact Revenue Coverage %.
- [x] Define Unallocated Revenue Coverage %.
- [x] Define Last Successful Sales Sync.
- [x] Define Data Freshness.
- [x] Define Sync Error Count.
- [x] Define Missing Product_ID anomaly.
- [x] Inspect actual order status values in production/staging data.
- [x] Define which statuses are commercial, cancelled, test, refunded, pending, or excluded.
- [x] Define known test-order exclusion policy, including `TEST-` identities where appropriate.
- [x] Define date basis: `order_date` vs ingestion timestamp.
- [x] Define timezone handling explicitly.
- [x] Confirm canonical Product_ID is `products.id`.
- [x] Confirm canonical order identity is `(source_system, source_order_id)`.
- [x] Confirm item identity is `(sales_order_id, source_item_key)`.
- [x] Document source normalization assumptions.
- [x] Document EXACT vs UNALLOCATED rules.
- [x] Create a developer-readable Metric Dictionary.

## Deliverables

- [x] `Metric Dictionary` Markdown document.
- [x] Status/exclusion matrix.
- [x] Date/time rule.
- [x] Revenue attribution rule.
- [x] Metric-to-SQL design notes for Phase 3.

## Verification / Test Checklist

- [x] Walk through at least one single-item order.
- [x] Walk through at least one multi-item order.
- [x] Walk through one UNALLOCATED order.
- [x] Walk through one cancelled/test order.
- [x] Verify no metric depends on invented line revenue.

## Definition of Done

- [x] Every KPI planned for the Data Analyst dashboard has one explicit definition.
- [x] Order-level and product-level metrics cannot be confused.
- [x] Commercial/test/cancelled rules are documented.
- [x] Phase 3 SQL can be implemented without business-rule ambiguity.

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
- [x] Prepare a concise handoff for Phase 3 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 02 — Metric Contract & Analytical Data Design`

## Droid Working Instruction

> Work on **Phase 02 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-19)

Every task, deliverable, verification, and handoff item above was completed during the 2026-09-07 build session; this checklist was not updated at the time. Verified 2026-09-19:
- Metric Dictionary exists: `02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md` (321 lines).
- Automated coverage check confirmed all 25 required concepts are defined in the document (all 19 metrics, status/exclusion matrix incl. `TEST-` policy, `order_date` date basis, timezone rule, canonical identities `products.id` / `(source_system, source_order_id)` / `(sales_order_id, source_item_key)`, EXACT vs UNALLOCATED rules).
- Walkthrough verification was superseded in practice by the Phase 08 backfill, which exercised single-item, multi-item, UNALLOCATED, and test-exclusion cases against 493 real production orders (`09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md` §8).
- Handoff exists: `09_Handoffs/Phase_02_Handoff_Metric_Contract_2026-09-07.md`.
