# MildMate Marketing Decision System — Phase 01
## Architecture Audit & Developer Setup

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

Establish the exact current technical baseline before changing code.

## Prerequisites / Confirmed Baseline

- [x] Existing MildMate website project is live.
- [x] Existing Super Admin marketing area exists at `/super-admin/marketing/`.
- [x] Unified D1 sales tables and production Sales API already exist.
- [x] Notion → Make.com → D1 Sales Sync has been technically validated.

## Task Checklist

- [ ] Open `D:/00_Mildmate/Re-build_web/` and verify repository root.
- [ ] Confirm Git remote, current branch, and working-tree state.
- [ ] Create/switch to `feature/marketing-data-analyst` only after confirming the working tree is safe.
- [ ] Inspect current `/super-admin/` route structure.
- [ ] Inspect exact files/routes implementing `/super-admin/marketing/`.
- [ ] Inspect Super Admin authentication and authorization flow.
- [ ] Identify reusable navigation, sidebar, header, card, table, filter, and CSS patterns.
- [ ] Inspect frontend JavaScript architecture used by Super Admin.
- [ ] Inspect Worker / Pages Functions route registration.
- [ ] Inspect D1 binding/configuration in the project.
- [ ] Inspect current schemas for `products`, `sales_orders`, `sales_order_items`, and `sync_runs`.
- [ ] Inspect the current Sales API implementation and error-response conventions.
- [ ] Confirm the latest migration number.
- [ ] Identify existing admin/read API patterns that can be reused.
- [ ] Verify whether `/super-admin/marketing/data-analyst/` fits the current routing convention.
- [ ] List files likely to add, files likely to modify, and files that should remain untouched.
- [ ] Document technical risks, especially auth, routing, D1 bindings, and deployment.
- [ ] Save the Phase 1 audit report under `01_MildMate_Marketing/`.

## Deliverables

- [ ] Verified architecture audit report.
- [ ] Confirmed Data Analyst route.
- [ ] Confirmed feature-branch setup.
- [ ] File-level implementation map for Phase 2.
- [ ] List of systems/files that must remain unchanged.

## Verification / Test Checklist

- [ ] No code or schema changes in the audit portion.
- [ ] Repository remains buildable/unchanged after audit.
- [ ] Branch state is documented.
- [ ] All claimed routes/files are verified from source.

## Definition of Done

- [ ] Current architecture is documented from the actual repository, not assumptions.
- [ ] Super Admin auth and routing are understood.
- [ ] D1 schema and API patterns are verified.
- [ ] Phase 2 can proceed without guessing file paths or architecture.

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
- [ ] Prepare a concise handoff for Phase 2 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 01 — Architecture Audit & Developer Setup`

## Droid Working Instruction

> Work on **Phase 01 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
