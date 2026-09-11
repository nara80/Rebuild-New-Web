# MildMate Marketing Decision System — Phase 08
## Historical Sales Backfill & Reconciliation

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

Populate enough historical unified sales data to support meaningful product/channel trends.

> **Reconciliation note (2026-09-11):** the backfill engine for Notion-confirmed orders is the Phase 07 v3 **confirmed-mapping sync CLI** (`scripts/notion-product-mapper.mjs`). It already satisfies by construction: no live `From now on` watcher for historical replay (reads Notion directly; Make sync stays OFF until this phase decides activation), stable `(source_system, source_order_id)` identity, deterministic Make-compatible `source_item_key = {Order_Number}-{n}`, exact order totals, `UNALLOCATED` line revenue (never equal-split), Mapped-only eligibility preserving verified mappings, controlled batches with `--limit`/`--resume`, and JSONL failure logging with safe UPSERT re-runs. Dry-run of known record ID 1038 verified 2026-09-11. Remaining Phase 08 work: scope/date range, live batch execution, count/revenue reconciliation vs Notion, coverage by period, dashboard historical-coverage view, gaps report. See `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

## Prerequisites / Confirmed Baseline

- [x] Phase 7 mapping workflow sufficiently reliable. *(v3 confirmed-mapping sync built + dry-run verified; live single-record test pending approval)*
- [x] Sales API idempotency already verified.

## Task Checklist

- [ ] Define historical backfill date range and scope.
- [ ] Define controlled batch size.
- [ ] Do not use the live `From now on` watcher for historical replay.
- [ ] Map historical orders before/while backfilling according to approved process.
- [ ] Use stable `(source_system, source_order_id)` identity.
- [ ] Use deterministic `source_item_key` values.
- [ ] Preserve exact order totals.
- [ ] Keep unknown line revenue `UNALLOCATED`.
- [ ] Do not equal-split historical totals.
- [ ] Preserve already verified mappings.
- [ ] Backfill in controlled batches.
- [ ] Record failed/rejected orders for review.
- [ ] Re-run corrected records safely using UPSERT behavior.
- [ ] Reconcile order counts against Notion.
- [ ] Reconcile total order revenue by channel/date where source data allows.
- [ ] Measure mapping coverage by period.
- [ ] Document remaining data gaps.
- [ ] Update Data Analyst dashboard to show historical coverage.

## Deliverables

- [ ] Historical sales loaded into unified D1.
- [ ] Reconciliation report.
- [ ] Known gaps/exceptions list.
- [ ] Historical coverage metrics.

## Verification / Test Checklist

- [ ] Duplicate re-run returns unchanged/updated rather than duplicate.
- [ ] Multi-item historical orders remain one order header.
- [ ] UNALLOCATED logic preserved.
- [ ] Channel totals reconcile within documented differences.
- [ ] Failed records are recoverable.

## Definition of Done

- [ ] Historical data is sufficient for 28-day/90-day trends and participation analysis.
- [ ] Backfill is reconciled and documented.
- [ ] Live ongoing sync remains separate and safe.

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
- [ ] Prepare a concise handoff for Phase 9 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 08 — Historical Sales Backfill & Reconciliation`

## Droid Working Instruction

> Work on **Phase 08 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
