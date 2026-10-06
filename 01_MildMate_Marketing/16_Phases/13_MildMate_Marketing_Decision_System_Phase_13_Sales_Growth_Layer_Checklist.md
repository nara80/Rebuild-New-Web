# MildMate Marketing Decision System — Phase 13
## Sales Growth Layer

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

Build a sales-growth analytical layer that identifies demand, momentum, conversion, and channel opportunities across MildMate products and listings, while using profitability as a secondary guardrail.

## Responsibility Boundary

- **Phase 13 owns:** growth signals, source freshness, mapping coverage, confidence metadata, and contract stability.
- **Phase 14 owns:** decision formula, score weighting, ranking, and recommendation logic.

## Prerequisites / Confirmed Baseline

- [x] Sales analytical layer and channel/product views are operational.
- [x] GSC / GA4 / Etsy / Google Ads ingestion infrastructure exists.
- [x] Profitability layer exists and remains available as a secondary guardrail.
- [x] Paid-media business signal may be sparse; missing/immature data must be neutral (not scored up/down).

## Task Checklist

- [ ] Publish a versioned growth contract (`growth_signal_contract: "v1"`).
- [ ] Expose demand signal with coverage/freshness/confidence metadata.
- [ ] Expose momentum signal with 28d vs previous 28d framing.
- [ ] Expose conversion availability signal (available vs insufficient).
- [ ] Expose channel context signal (breadth, concentration, participation).
- [ ] Expose source freshness signal across active sources.
- [ ] Expose mapping coverage signal across relevant growth sources.
- [ ] Expose confidence signal based on signal quality and completeness.
- [ ] Expose profitability guardrail signal as secondary context only.
- [ ] Encode Google Ads as available infrastructure but currently insufficient business signal when sparse/zero.
- [ ] Keep decision/ranking logic unchanged in Phase 14 code.
- [ ] Add Growth Signals section to Data Analyst UI before profitability/ranking blocks.
- [ ] Document assumptions and signal-status semantics.

## Deliverables

- [ ] Phase 13 Sales Growth contract spec (v1).
- [ ] Read-only Growth Signals API output.
- [ ] Data Analyst Growth Signals UI section.
- [ ] Reconciliation summary with boundaries and test evidence.

## Verification / Test Checklist

- [ ] API returns all growth signals with `value/status/coverage/freshness_days/confidence_impact/reason` where applicable.
- [ ] Sparse/zero Google Ads does not increase or decrease growth scores directly.
- [ ] Growth signal statuses correctly show insufficient/stale/mapping-gap states.
- [ ] Profitability appears as guardrail metadata only, not as ranking output in this phase.
- [ ] Existing opportunity model (`v1`) behavior is unchanged.
- [ ] Existing Friday opportunity recompute behavior is unchanged.

## Definition of Done

- [ ] Growth signals are visible and auditable from the dashboard and API.
- [ ] Data gaps are transparent and represented through confidence/coverage, never hidden as zeros.
- [ ] Phase 13 changes do not alter Phase 14 scoring model/weights/ranking.

## Global Guardrails

- [!] Do not expose `SALES_SYNC_API_TOKEN` or any production secret.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not modify or replace the existing operational website `orders` system unless explicitly approved.
- [!] Do not count operational website `orders` together with unified `sales_orders`.
- [!] Do not invent historical line-item revenue.
- [!] `UNALLOCATED` revenue means unknown, not zero.
- [!] Do not equal-split multi-item order totals.
- [!] Do not expose unnecessary customer PII in marketing analytics.
- [!] Do not edit old production migrations; add a new migration only if schema changes are required.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not implement Phase 14 model changes here.

## Phase Handoff Rule

- [ ] Record files changed.
- [ ] Record API routes/UI routes created or changed.
- [ ] Record tests performed and results.
- [ ] Record unresolved issues and risks.
- [ ] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [ ] Prepare a concise handoff for Phase 14 and stop.
