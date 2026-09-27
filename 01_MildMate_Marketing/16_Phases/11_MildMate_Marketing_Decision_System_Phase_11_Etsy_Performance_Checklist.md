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

- [x] Reconcile current Etsy listing mappings against D1 Product_ID.
- [x] Support multiple Etsy listings per Product_ID when required.
- [x] Preserve inactive/deactivated listing identities.
- [x] Define Etsy listing master/fact schema.
- [x] Collect listing metadata.
- [x] Collect views/visits where API/report provides them.
- [x] Collect favorites where available.
- [x] Collect orders/transactions.
- [x] Collect Etsy revenue with clear source definition.
- [x] Build authenticated ingestion endpoint.
- [x] Build Make.com Etsy collector or approved structured import.
- [x] Use Etsy Listing ID as external key.
- [x] Build Etsy product/listing analytical views.
- [x] Add listing-status/freshness monitoring.
- [x] Add Etsy section to Data Analyst dashboard.

## Deliverables

- [x] Etsy listing mapping table/master.
- [x] Etsy performance fact table.
- [x] Etsy collector.
- [x] Etsy analysis dashboard.

## Verification / Test Checklist

- [x] Known listing IDs map to correct Product_ID.
- [x] Renamed listing does not break identity.
- [x] Inactive listing remains historically queryable.
- [x] Multiple listings for one Product_ID do not duplicate product identity.
- [ ] Revenue/order data reconciles to Etsy source definitions. *(pending first live Etsy ingest and sampled source reconciliation)*

## Definition of Done

- [x] Analyst can compare Etsy listing demand and sales by canonical MildMate Product_ID.

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
- [x] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`. *(handoff: `09_Handoffs/Phase_11_Handoff_Etsy_Analytics_2026-09-27.md`)*
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [x] Prepare a concise handoff for Phase 12 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 11 — Etsy Listing & Performance Analytics`

## Droid Working Instruction

> Work on **Phase 11 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-27)

Status update: **IMPLEMENTED IN REPOSITORY (pending production rollout + first live Etsy reconciliation)**. Added migration `049_etsy_analytics.sql` (listing master + Etsy daily fact + analysis/freshness views), token-auth Etsy ingestion API under `/api/v1/etsy/*`, Etsy read endpoint `/api/admin/analysis/etsy`, Data Analyst Etsy section, Data Quality Etsy freshness wiring, and weekly Etsy collector path in `marketing-sync-worker` (`/etsy/run`, `/etsy/status`, cron `0 5 * * 1`). Remaining for full operational verification: deploy updated runtime, run first live Etsy ingest, then reconcile sampled Etsy listing totals and revenue/order definitions against source exports/API.
