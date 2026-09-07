# MildMate Marketing Decision System — Phase 14
## Opportunity & Decision Engine

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

Rank product/channel opportunities consistently using approved analytical inputs and data confidence.

## Prerequisites / Confirmed Baseline

- [x] Core sales, demand, conversion, channel, and profitability metrics available.

## Task Checklist

- [ ] Define exact Opportunity Score formula.
- [ ] Define Demand component.
- [ ] Define Sales Momentum component.
- [ ] Define Conversion component.
- [ ] Define Profitability component.
- [ ] Define Channel Fit component.
- [ ] Define Strategic Fit component.
- [ ] Normalize input ranges.
- [ ] Define minimum-data thresholds.
- [ ] Create Data Confidence Score.
- [ ] Penalize/flag low mapping coverage.
- [ ] Penalize/flag high UNALLOCATED coverage where relevant.
- [ ] Penalize/flag stale source data.
- [ ] Define insufficient-data state instead of forcing a score.
- [ ] Store score history.
- [ ] Store component breakdown.
- [ ] Create human-readable explanation for each score.
- [ ] Build product × channel opportunity ranking.
- [ ] Add Opportunity section to Data Analyst/Marketing area.
- [ ] Validate rankings with business review before automating recommendations.

## Deliverables

- [ ] Opportunity formula specification.
- [ ] Data Confidence model.
- [ ] Historical score storage.
- [ ] Opportunity ranking UI.

## Verification / Test Checklist

- [ ] Same inputs produce same score.
- [ ] Low-confidence data is visibly downgraded/flagged.
- [ ] Missing source data does not create false zero-demand conclusions.
- [ ] Score component totals reconcile.
- [ ] Business-review sample rankings are explainable.

## Definition of Done

- [ ] Each opportunity has a reproducible score, confidence level, and reason.
- [ ] No AI-generated facts are used as score inputs.

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
- [ ] Prepare a concise handoff for Phase 15 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 14 — Opportunity & Decision Engine`

## Droid Working Instruction

> Work on **Phase 14 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
