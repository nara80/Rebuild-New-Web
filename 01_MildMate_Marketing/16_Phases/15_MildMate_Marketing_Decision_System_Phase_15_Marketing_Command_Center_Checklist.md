# MildMate Marketing Decision System — Phase 15
## Marketing Command Center

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

Turn the existing `/super-admin/marketing/` area into the owner/decision view for WHAT, WHERE, WHY, HOW MUCH, and WHAT NEXT.

## Prerequisites / Confirmed Baseline

- [x] Data Analyst dashboard established.
- [x] Opportunity Engine working.
- [x] Data Confidence visible.

## Task Checklist

- [ ] Define Executive summary page.
- [ ] Show top product opportunities.
- [ ] Show top channel opportunities.
- [ ] Show major risks/alerts.
- [ ] Show data-confidence indicator next to recommendations/opportunities.
- [ ] Add Product drill-down.
- [ ] Add Channel drill-down.
- [ ] Link to Data Analyst detail views.
- [ ] Add SEO summary.
- [ ] Add Etsy summary.
- [ ] Add Paid Media summary.
- [ ] Add profitability summary.
- [ ] Add recommendation cards/placeholders.
- [ ] Add human review/approval state.
- [ ] Add marketing action status.
- [ ] Add result-review date.
- [ ] Keep the executive view concise and decision-oriented.
- [ ] Reuse existing Super Admin marketing navigation and design.
- [ ] Do not duplicate detailed analyst tables unnecessarily.

## Deliverables

- [ ] Marketing Command Center executive view.
- [ ] Product/channel drill-downs.
- [ ] Opportunity and alert presentation.
- [ ] Human review/approval interface.

## Verification / Test Checklist

- [ ] Owner can identify top actions within a few minutes.
- [ ] Every recommendation/opportunity links to supporting data.
- [ ] Low-confidence opportunities are visibly marked.
- [ ] Executive totals match Data Analyst source metrics.

## Definition of Done

- [ ] `/super-admin/marketing/` answers WHAT / WHERE / WHY / HOW MUCH / WHAT NEXT using trusted analytical data.

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
- [ ] Prepare a concise handoff for Phase 16 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 15 — Marketing Command Center`

## Droid Working Instruction

> Work on **Phase 15 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
