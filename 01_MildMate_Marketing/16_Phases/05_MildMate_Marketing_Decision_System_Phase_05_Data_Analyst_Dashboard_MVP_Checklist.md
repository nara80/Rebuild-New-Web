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

- [ ] Implement the verified Data Analyst route, preferably `/super-admin/marketing/data-analyst/`.
- [ ] Add `Data Analyst` navigation entry under the existing Marketing area.
- [ ] Reuse existing Super Admin visual shell.
- [ ] Build KPI card: Commercial Orders.
- [ ] Build KPI card: Order Revenue.
- [ ] Build KPI card: Units.
- [ ] Build KPI card: Average Order Value.
- [ ] Build KPI card: Mapped %.
- [ ] Build KPI card: Unallocated Revenue %.
- [ ] Build KPI card: Last Sales Sync.
- [ ] Build KPI card/status: Data Quality.
- [ ] Add date-range filter.
- [ ] Add channel filter.
- [ ] Add product filter.
- [ ] Add order-status filter.
- [ ] Add mapping-status filter.
- [ ] Add revenue-status filter.
- [ ] Build Sales Detail table.
- [ ] Build Product Participation table.
- [ ] Build Channel Analysis table.
- [ ] Make Product_ID visible in analyst-oriented tables.
- [ ] Add loading state.
- [ ] Add no-data state.
- [ ] Add API-error state.
- [ ] Add data freshness indicator.
- [ ] Make layout readable on desktop and reasonable on tablet/mobile.
- [ ] Keep customer PII out of the page.
- [ ] Match existing Super Admin styling.

## Deliverables

- [ ] Data Analyst MVP page.
- [ ] Navigation integration.
- [ ] Filters and KPI cards.
- [ ] Three core analysis tables.

## Verification / Test Checklist

- [ ] Authenticated Super Admin can open the page.
- [ ] Unauthorized user cannot access the page.
- [ ] Filters update data correctly.
- [ ] Totals match API/analytical layer.
- [ ] Product_ID drill/filter works.
- [ ] Empty periods render cleanly.
- [ ] API errors render cleanly.
- [ ] Desktop and mobile/tablet visual check.

## Definition of Done

- [ ] User can answer core D1 sales questions without asking Droid CLI.
- [ ] Dashboard numbers match the analytical layer.
- [ ] No future Opportunity/AI features are mixed into the MVP.

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
- [ ] Prepare a concise handoff for Phase 6 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 05 — Data Analyst Dashboard MVP`

## Droid Working Instruction

> Work on **Phase 05 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
