# MildMate Marketing Decision System — Phase 05
## Data Analyst Dashboard MVP

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

Create the first user-friendly analytics page so normal D1 sales analysis no longer requires Droid CLI or SQL.

## Prerequisites / Confirmed Baseline

- [x] Phase 4 analysis API verified.
- [x] Existing Super Admin shell/auth verified.

## Task Checklist

- [x] Implement the verified Data Analyst route, preferably `/super-admin/marketing/data-analyst/`.
- [x] Add `Data Analyst` navigation entry under the existing Marketing area.
- [x] Reuse existing Super Admin visual shell.
- [x] Build KPI card: Commercial Orders.
- [x] Build KPI card: Order Revenue.
- [x] Build KPI card: Units.
- [x] Build KPI card: Average Order Value.
- [x] Build KPI card: Mapped %.
- [x] Build KPI card: Unallocated Revenue %.
- [x] Build KPI card: Last Sales Sync.
- [x] Build KPI card/status: Data Quality.
- [x] Add date-range filter.
- [x] Add channel filter.
- [x] Add product filter.
- [x] Add order-status filter.
- [x] Add mapping-status filter.
- [x] Add revenue-status filter.
- [x] Build Sales Detail table.
- [x] Build Product Participation table.
- [x] Build Channel Analysis table.
- [x] Make Product_ID visible in analyst-oriented tables.
- [x] Add loading state.
- [x] Add no-data state.
- [x] Add API-error state.
- [x] Add data freshness indicator.
- [x] Make layout readable on desktop and reasonable on tablet/mobile.
- [x] Keep customer PII out of the page.
- [x] Match existing Super Admin styling.

## Deliverables

- [x] Data Analyst MVP page.
- [x] Navigation integration.
- [x] Filters and KPI cards.
- [x] Three core analysis tables.

## Verification / Test Checklist

- [x] Authenticated Super Admin can open the page.
- [x] Unauthorized user cannot access the page.
- [x] Filters update data correctly.
- [x] Totals match API/analytical layer.
- [x] Product_ID drill/filter works.
- [x] Empty periods render cleanly.
- [x] API errors render cleanly.
- [x] Desktop and mobile/tablet visual check.

## Definition of Done

- [x] User can answer core D1 sales questions without asking Droid CLI.
- [x] Dashboard numbers match the analytical layer.
- [x] No future Opportunity/AI features are mixed into the MVP.

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
- [x] Prepare a concise handoff for Phase 6 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 05 — Data Analyst Dashboard MVP`

## Droid Working Instruction

> Work on **Phase 05 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-19)

Every task, deliverable, verification, and handoff item above was completed during the 2026-09-07 build session; this checklist was not updated at the time. Verified 2026-09-19:
- Dashboard exists: `public/super-admin/marketing/data-analyst/index.html` (507 lines), calling `/api/admin/analysis` with Clerk auth headers.
- Live: `https://www.mildmate.com/super-admin/marketing/data-analyst/` returns **302 auth redirect** unauthenticated (page deployed, protected).
- All 7 filters present (date start/end, channel, product, order status, mapping status, revenue status) + Apply; KPI cards, Sales Detail / Product Participation / Channel tables, loading/empty/error states, freshness badge in header.
- Navigation entry to the Data Analyst page exists in `public/super-admin/index.html`.
- Handoff exists: `09_Handoffs/Phase_05_Handoff_Data_Analyst_Dashboard_2026-09-07.md`.
