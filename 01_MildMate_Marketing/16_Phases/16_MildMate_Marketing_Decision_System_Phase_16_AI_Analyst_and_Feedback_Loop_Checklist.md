# MildMate Marketing Decision System — Phase 16
## AI Analyst & Marketing Action Feedback Loop

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

Use AI to interpret trusted analytics, record approved actions, and measure whether actions worked.

## Prerequisites / Confirmed Baseline

- [x] Marketing Command Center and Opportunity Engine working.
- [x] Data Confidence available.
- [x] Canonical metrics/history available in D1.

## Task Checklist

- [ ] Define AI input contract.
- [ ] Provide AI only canonical product data and approved analytical metrics.
- [ ] Provide Opportunity Score and Data Confidence.
- [ ] Provide historical action/results context where relevant.
- [ ] Define standard recommendation output: Product, Action, Channel, Why, Budget/Test, Success Target, Confidence, Review Date.
- [ ] Prevent AI from inventing Product_ID, revenue, costs, or metrics.
- [ ] Create `marketing_actions` table or approved equivalent.
- [ ] Store recommendation reason.
- [ ] Store baseline metrics.
- [ ] Store approved budget.
- [ ] Store start/end/review dates.
- [ ] Store human approval/rejection.
- [ ] Store post-action metrics.
- [ ] Classify result: positive / neutral / negative / inconclusive.
- [ ] Record lessons learned.
- [ ] Feed verified historical action outcomes into future AI context.
- [ ] Add AI Analyst panel to Marketing Command Center.
- [ ] Add Action History and Results views.
- [ ] Add audit trail for AI-generated vs human-approved content.
- [ ] Define safe fallback when data confidence is insufficient.

## Deliverables

- [ ] AI Analyst recommendation interface.
- [ ] `marketing_actions` history.
- [ ] Approval workflow.
- [ ] Baseline/result comparison.
- [ ] Feedback loop.

## Verification / Test Checklist

- [ ] AI recommendation cites only available metrics.
- [ ] Low-confidence case results in cautious/insufficient-data recommendation.
- [ ] Rejected recommendation is preserved but not marked executed.
- [ ] Approved action stores baseline.
- [ ] Post-action review calculates result using canonical metrics.
- [ ] AI cannot write canonical sales/product facts.

## Definition of Done

- [ ] System can answer WHAT / WHERE / WHY / HOW MUCH / WHAT NEXT / DID IT WORK.
- [ ] Approved marketing actions and their outcomes are historically auditable.
- [ ] AI acts as analyst/advisor, not source of truth.

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
- [ ] Prepare final system reconciliation and operating handoff.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 16 — AI Analyst & Marketing Action Feedback Loop`

## Droid Working Instruction

> Work on **Phase 16 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
