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

- [x] Open `D:/00_Mildmate/Re-build_web/` and verify repository root.
- [x] Confirm Git remote, current branch, and working-tree state.
- [x] Create/switch to `feature/marketing-data-analyst` only after confirming the working tree is safe.
- [x] Inspect current `/super-admin/` route structure.
- [x] Inspect exact files/routes implementing `/super-admin/marketing/`.
- [x] Inspect Super Admin authentication and authorization flow.
- [x] Identify reusable navigation, sidebar, header, card, table, filter, and CSS patterns.
- [x] Inspect frontend JavaScript architecture used by Super Admin.
- [x] Inspect Worker / Pages Functions route registration.
- [x] Inspect D1 binding/configuration in the project.
- [x] Inspect current schemas for `products`, `sales_orders`, `sales_order_items`, and `sync_runs`.
- [x] Inspect the current Sales API implementation and error-response conventions.
- [x] Confirm the latest migration number.
- [x] Identify existing admin/read API patterns that can be reused.
- [x] Verify whether `/super-admin/marketing/data-analyst/` fits the current routing convention.
- [x] List files likely to add, files likely to modify, and files that should remain untouched.
- [x] Document technical risks, especially auth, routing, D1 bindings, and deployment.
- [x] Save the Phase 1 audit report under `01_MildMate_Marketing/`.

## Deliverables

- [x] Verified architecture audit report.
- [x] Confirmed Data Analyst route.
- [x] Confirmed feature-branch setup.
- [x] File-level implementation map for Phase 2.
- [x] List of systems/files that must remain unchanged.

## Verification / Test Checklist

- [x] No code or schema changes in the audit portion.
- [x] Repository remains buildable/unchanged after audit.
- [x] Branch state is documented.
- [x] All claimed routes/files are verified from source.

## Definition of Done

- [x] Current architecture is documented from the actual repository, not assumptions.
- [x] Super Admin auth and routing are understood.
- [x] D1 schema and API patterns are verified.
- [x] Phase 2 can proceed without guessing file paths or architecture.

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
- [x] Prepare a concise handoff for Phase 2 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 01 — Architecture Audit & Developer Setup`

## Droid Working Instruction

> Work on **Phase 01 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-19)

Every task, deliverable, verification, and handoff item above was completed during the 2026-09-07 build session; this checklist was not updated at the time. Verified 2026-09-19:
- Audit report exists: `09_Handoffs/Phase_01_Architecture_Audit_Report_2026-09-07.md`.
- Branch `feature/marketing-data-analyst` exists locally and on `origin` (final implementation was merged to `master`).
- Route convention confirmed in practice: `/super-admin/marketing/data-analyst/` is live (returns 302 auth redirect when unauthenticated).
- Schemas for `products`/`sales_orders`/`sales_order_items`/`sync_runs` verified in production D1 during this reconciliation.
