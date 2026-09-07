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

- [ ] Define Commercial Order Count.
- [ ] Define Order Revenue.
- [ ] Define Units.
- [ ] Define Average Order Value.
- [ ] Define Orders Containing Product.
- [ ] Define Product Quantity.
- [ ] Define Exact Product Revenue.
- [ ] Define Product Attach Rate.
- [ ] Define Product Co-Purchase Rate.
- [ ] Define Orders by Channel.
- [ ] Define Revenue by Channel.
- [ ] Define Mapped Order %.
- [ ] Define Mapped Item % if useful.
- [ ] Define Exact Revenue Coverage %.
- [ ] Define Unallocated Revenue Coverage %.
- [ ] Define Last Successful Sales Sync.
- [ ] Define Data Freshness.
- [ ] Define Sync Error Count.
- [ ] Define Missing Product_ID anomaly.
- [ ] Inspect actual order status values in production/staging data.
- [ ] Define which statuses are commercial, cancelled, test, refunded, pending, or excluded.
- [ ] Define known test-order exclusion policy, including `TEST-` identities where appropriate.
- [ ] Define date basis: `order_date` vs ingestion timestamp.
- [ ] Define timezone handling explicitly.
- [ ] Confirm canonical Product_ID is `products.id`.
- [ ] Confirm canonical order identity is `(source_system, source_order_id)`.
- [ ] Confirm item identity is `(sales_order_id, source_item_key)`.
- [ ] Document source normalization assumptions.
- [ ] Document EXACT vs UNALLOCATED rules.
- [ ] Create a developer-readable Metric Dictionary.

## Deliverables

- [ ] `Metric Dictionary` Markdown document.
- [ ] Status/exclusion matrix.
- [ ] Date/time rule.
- [ ] Revenue attribution rule.
- [ ] Metric-to-SQL design notes for Phase 3.

## Verification / Test Checklist

- [ ] Walk through at least one single-item order.
- [ ] Walk through at least one multi-item order.
- [ ] Walk through one UNALLOCATED order.
- [ ] Walk through one cancelled/test order.
- [ ] Verify no metric depends on invented line revenue.

## Definition of Done

- [ ] Every KPI planned for the Data Analyst dashboard has one explicit definition.
- [ ] Order-level and product-level metrics cannot be confused.
- [ ] Commercial/test/cancelled rules are documented.
- [ ] Phase 3 SQL can be implemented without business-rule ambiguity.

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
- [ ] Prepare a concise handoff for Phase 3 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 02 — Metric Contract & Analytical Data Design`

## Droid Working Instruction

> Work on **Phase 02 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
