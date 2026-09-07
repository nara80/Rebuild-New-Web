# MildMate Marketing Decision System — Phase 07
## Product Mapping Automation Completion

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

Automatically resolve unmapped Notion order items to canonical D1 Product_IDs before sales analysis.

## Prerequisites / Confirmed Baseline

- [x] Existing Notion mapping fields exist.
- [x] Existing Sales Sync only processes mapped orders.
- [x] Actual selected variation outranks parent listing title.
- [x] D1 products now include IDs 33 and 34.

## Task Checklist

- [ ] Reconcile the product-mapping catalog with all current products, including IDs 33 and 34.
- [ ] Build/finish `MildMate - Notion Order Product Mapper` in Make.com.
- [ ] Retrieve only eligible unmapped/review records according to approved workflow mode.
- [ ] Preserve already verified mappings.
- [ ] Parse `ProductJSON` / `Product_Info` without overwriting original source text.
- [ ] Resolve exact marketplace variation first.
- [ ] Resolve exact verified alias second.
- [ ] Use listing + variation mapping where needed.
- [ ] Use deterministic rules only when defensible.
- [ ] Use AI only as bounded fallback against approved Product_ID catalog.
- [ ] Never allow AI to invent Product_ID.
- [ ] Set low-confidence records to `Review Required`.
- [ ] Write `D1_Product_IDs`.
- [ ] Write `D1_Product_Map`.
- [ ] Write `Product_Mapping_Status`.
- [ ] Where implemented, store human corrections as reusable D1 mapping memory.
- [ ] Measure mapping coverage.
- [ ] Surface mapping coverage in Data Analyst dashboard.

## Deliverables

- [ ] Production-ready product mapping scenario.
- [ ] Updated mapping catalog.
- [ ] Review-required path.
- [ ] Mapping coverage metrics.

## Verification / Test Checklist

- [ ] Known ID 1038 maps to D1 20 + 26.
- [ ] Single-item order.
- [ ] Multi-item order.
- [ ] Ambiguous listing title with clear variation.
- [ ] Unknown variation → Review Required.
- [ ] Already-verified mapping remains unchanged.
- [ ] IDs 33/34 can be selected/resolved where applicable.

## Definition of Done

- [ ] New eligible orders can reach `Mapped` status automatically when evidence is strong.
- [ ] Ambiguous items are never silently guessed.
- [ ] Mapped orders can flow into the already-built Sales Sync.

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
- [ ] Prepare a concise handoff for Phase 8 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 07 — Product Mapping Automation Completion`

## Droid Working Instruction

> Work on **Phase 07 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
