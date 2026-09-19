# MildMate Marketing Decision System — Phase 06
## Data Quality & Sync Monitor

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

Make data reliability visible before using the data for marketing decisions.

## Prerequisites / Confirmed Baseline

- [x] Phase 5 Data Analyst MVP working.

## Task Checklist

- [x] Surface latest successful sales sync from `sync_runs` or verified equivalent.
- [x] Show sync freshness/status.
- [x] Show mapped order/item percentage.
- [x] Show unmapped order/item count.
- [x] Show EXACT vs UNALLOCATED coverage.
- [x] Show missing Product_ID count.
- [x] Show unexpected/unknown source labels.
- [x] Show orders with no active items.
- [x] Show suspicious null/zero totals where business rules say they are invalid.
- [x] Show recent API/sync errors if available.
- [x] Define severity levels: OK / Warning / Critical.
- [x] Create human-readable explanations for each alert.
- [x] Add drill-down to affected records where safe.
- [x] Add source freshness by channel where available.
- [x] Document acceptable freshness thresholds.
- [x] Add data-quality status to the main Data Analyst header.

## Deliverables

- [x] Data Quality section/page.
- [x] Sync health indicators.
- [x] Exception lists.
- [x] Severity rules.

## Verification / Test Checklist

- [x] Simulate/locate a stale sync case.
- [x] Simulate/locate a missing Product_ID case.
- [x] Verify unmapped counts.
- [x] Verify EXACT/UNALLOCATED percentages.
- [x] Verify no false critical state when data is valid.

## Definition of Done

- [x] Analyst can determine whether the data is trustworthy before making decisions.
- [x] Major quality problems are visible without SQL.

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
- [x] Prepare a concise handoff for Phase 7 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 06 — Data Quality & Sync Monitor`

## Droid Working Instruction

> Work on **Phase 06 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-19)

Every task, deliverable, verification, and handoff item above was completed during the 2026-09-10 build session; this checklist was not updated at the time. Verified 2026-09-19:
- `analysis_data_quality` view live in production; `GET /api/admin/analysis/data-quality` returns 401 unauthenticated (exists, protected).
- Data Analyst dashboard contains **Data Quality & Sync Monitor** section, **Source Freshness** table, header `freshness-badge`, and a Data Quality KPI card (verified in source, lines 77–149).
- Super Admin Orders page carries the Sales Sync health banner (`renderSalesSyncBanner` in `public/super-admin/index.html`; `sales_sync` payload from `workers/api/admin-orders.ts::getLatestSalesSyncRun`) with HEALTHY / DELAYED / FAILED / empty states (commit `d8504d7`).
- Stale-sync case exists live today: `notion-orderlist` (Make.com) last ran 2026-09-07 (intentionally OFF), so freshness/stale rendering is exercised by real data.
- Handoff exists: `09_Handoffs/Phase_06_Handoff_Data_Quality_Sync_Monitor_2026-09-10.md`.
