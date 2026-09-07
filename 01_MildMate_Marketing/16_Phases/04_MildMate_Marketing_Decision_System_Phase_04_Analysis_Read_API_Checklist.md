# MildMate Marketing Decision System — Phase 04
## Authenticated Read-Only Analysis API

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

Expose the approved analytical layer to the Super Admin through stable, authenticated read-only endpoints.

## Prerequisites / Confirmed Baseline

- [x] Phase 3 analytical layer implemented and tested.
- [x] Existing Super Admin auth pattern verified in Phase 1.

## Task Checklist

- [ ] Reuse the existing Super Admin authentication/authorization flow.
- [ ] Follow existing API route naming conventions.
- [ ] Implement summary endpoint.
- [ ] Implement sales-detail endpoint.
- [ ] Implement product-analysis endpoint.
- [ ] Implement product-detail endpoint by Product_ID.
- [ ] Implement channel-analysis endpoint.
- [ ] Implement data-quality endpoint.
- [ ] Add date-range parameters.
- [ ] Add channel filter.
- [ ] Add Product_ID filter.
- [ ] Add order-status filter where useful.
- [ ] Add mapping/revenue-status filters where useful.
- [ ] Validate every query parameter.
- [ ] Use pagination for detailed tables.
- [ ] Set safe maximum page size.
- [ ] Use bounded date ranges if needed for performance.
- [ ] Return machine-readable error responses.
- [ ] Return clear empty-data responses.
- [ ] Do not expose D1 credentials or secrets.
- [ ] Do not return unnecessary customer PII.
- [ ] Document endpoint contracts.

## Deliverables

- [ ] Read-only analysis API routes.
- [ ] API response examples.
- [ ] API error schema.
- [ ] Endpoint documentation.

## Verification / Test Checklist

- [ ] Authenticated request succeeds.
- [ ] Unauthorized request is rejected.
- [ ] Invalid date/filter parameter is rejected cleanly.
- [ ] Empty result returns valid empty response.
- [ ] Pagination works.
- [ ] Product_ID filter works.
- [ ] Channel filter works.
- [ ] Data-quality endpoint works.
- [ ] No PII leakage.

## Definition of Done

- [ ] All MVP Data Analyst data can be retrieved through authenticated read-only APIs.
- [ ] The browser never needs direct D1 access.
- [ ] API behavior is stable enough for Phase 5 UI.

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
- [ ] Prepare a concise handoff for Phase 5 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 04 — Authenticated Read-Only Analysis API`

## Droid Working Instruction

> Work on **Phase 04 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
