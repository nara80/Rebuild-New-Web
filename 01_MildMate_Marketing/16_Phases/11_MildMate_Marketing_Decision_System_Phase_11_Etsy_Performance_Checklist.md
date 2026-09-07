# MildMate Marketing Decision System — Phase 11
## Etsy Listing & Performance Analytics

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

Connect Etsy listing performance and sales signals to canonical MildMate products.

## Prerequisites / Confirmed Baseline

- [x] Product Master already contains a partial set of Etsy Listing IDs.
- [x] Etsy Listing ID is treated as durable external identity.

## Task Checklist

- [ ] Reconcile current Etsy listing mappings against D1 Product_ID.
- [ ] Support multiple Etsy listings per Product_ID when required.
- [ ] Preserve inactive/deactivated listing identities.
- [ ] Define Etsy listing master/fact schema.
- [ ] Collect listing metadata.
- [ ] Collect views/visits where API/report provides them.
- [ ] Collect favorites where available.
- [ ] Collect orders/transactions.
- [ ] Collect Etsy revenue with clear source definition.
- [ ] Build authenticated ingestion endpoint.
- [ ] Build Make.com Etsy collector or approved structured import.
- [ ] Use Etsy Listing ID as external key.
- [ ] Build Etsy product/listing analytical views.
- [ ] Add listing-status/freshness monitoring.
- [ ] Add Etsy section to Data Analyst dashboard.

## Deliverables

- [ ] Etsy listing mapping table/master.
- [ ] Etsy performance fact table.
- [ ] Etsy collector.
- [ ] Etsy analysis dashboard.

## Verification / Test Checklist

- [ ] Known listing IDs map to correct Product_ID.
- [ ] Renamed listing does not break identity.
- [ ] Inactive listing remains historically queryable.
- [ ] Multiple listings for one Product_ID do not duplicate product identity.
- [ ] Revenue/order data reconciles to Etsy source definitions.

## Definition of Done

- [ ] Analyst can compare Etsy listing demand and sales by canonical MildMate Product_ID.

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
- [ ] Prepare a concise handoff for Phase 12 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 11 — Etsy Listing & Performance Analytics`

## Droid Working Instruction

> Work on **Phase 11 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
