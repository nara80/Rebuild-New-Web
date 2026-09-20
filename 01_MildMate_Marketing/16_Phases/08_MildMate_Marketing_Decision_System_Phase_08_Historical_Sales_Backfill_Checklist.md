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

- [x] Phase 7 mapping workflow sufficiently reliable. *(v3 confirmed-mapping sync live-verified 2026-09-12: ID 1038 synced to prod + `D1_Last_Synced_Signature` write-back + idempotent re-run skipped unchanged)*
- [x] Sales API idempotency already verified.
- [x] Production D1 ready: migrations 043/044 applied (alias seed 1038→[20,26] present; events table empty) + all 10 analysis views live *(count corrected 2026-09-19: migration 042 defines 10 views)*. *(read-only verified 2026-09-12)*
- [x] Order `260804DW6XA3NA` (Notion ID 1038) confirmed not yet in prod — clean target for the first live sync. *(verified 2026-09-12; live sync completed the same day — order now in prod as `sales_orders` id 9)*

## Task Checklist

> **Reconciliation (2026-09-12):** items marked ✅ built are satisfied by construction by the Phase 07 v3 sync CLI (`scripts/notion-product-mapper.mjs`, the approved backfill engine). Unticked items require the live run or a user decision.

- [x] Define historical backfill date range and scope. *(user decision 2026-09-12: July 2026 and earlier via `--before 2026-08-01`, because Notion totals are corrected a month in arrears; plus the permanent rule that only records with a TotalAmount > 0 are eligible)*
- [x] Define controlled batch size. *(5 → 20 → 50 ramp defined in the v3 runbook)*
- [x] Do not use the live `From now on` watcher for historical replay. *(CLI reads Notion directly; Make.com sync stays OFF until the activation decision)*
- [x] Map historical orders before/while backfilling according to approved process. *(v3 approved process: Make.com is the mapping authority; the CLI syncs only `Mapped` records)*
- [x] Use stable `(source_system, source_order_id)` identity. *(built; verified in the ID 1038 dry-run payload)*
- [x] Use deterministic `source_item_key` values. *(built — Make-compatible `{Order_Number}-{n}`, verified against prod D1 convention)*
- [x] Preserve exact order totals. *(built; exact total 3480 THB confirmed in the 1038 dry-run payload)*
- [x] Keep unknown line revenue `UNALLOCATED`. *(built; no invented line revenue)*
- [x] Do not equal-split historical totals. *(by construction — line revenue is never split)*
- [x] Preserve already verified mappings. *(eligibility rule: `Mapped` + signature-difference only; mapping fields never written)*
- [x] Backfill in controlled batches. *(--limit/--resume built; live ramp 2026-09-12 → 13: single record 1038 + batch of 5 (4 synced) + batch of 20 (16 synced) + batch of 50 (49 synced, July scope) + record 1020 fixed by user and synced + **full July-and-earlier backfill (--resume --before 2026-08-01)** — completed and verified — 483 orders in prod; idempotency confirmed at each step; every non-dry-run emails its outcome to contact@mildmate.com (dry-runs skipped per user 2026-09-13, conserves Resend quota). **Scope rules (2026-09-12):** sync July 2026 and earlier via `--before 2026-08-01`, and only records with TotalAmount present — August is held back until corrected (end of September); no-total records are held permanently until their totals are filled in Notion. **Held list (18 records) after the full backfill:** 5 no-total + 6 ids-mismatch + 7 parse-failed — all flagged in the reconciliation doc with Notion IDs / order numbers and will re-sync automatically once corrected in Notion.)*
- [x] Record failed/rejected orders for review. *(built — JSONL logs with skip reasons: parse_failed, ids_mismatch, not Mapped, signature unchanged)*
- [x] Re-run corrected records safely using UPSERT behavior. *(upsert endpoint is idempotent — previously production-verified; safe re-run built into the engine)*
- [x] Reconcile order counts against Notion. *(2026-09-18: 493 orders, 737 items, all 493 with >=1 item, zero unmapped items)*
- [x] Reconcile total order revenue by channel/date where source data allows. *(THB 1,552,277.63 across 8 channels; per-channel + per-year tables sum to the total)*
- [x] Measure mapping coverage by period. *(2023: 1 / 2024: 2 / 2025: 137 / 2026: 353 orders; span 2023-07-19 -> 2026-09-11)*
- [x] Document remaining data gaps. *(reconciliation §8 "Known gaps / exceptions" — incl. the newly found price-as-quantity corruption on 2 Line orders)*
- [x] Update Data Analyst dashboard to show historical coverage. *(built 2026-09-20: "Historical Coverage" card on the Data Analyst dashboard — span 2023-07-19 → 2026-09-10, 483 commercial orders (10 of 493 sales_orders rows are non-commercial status, per metric contract), 7 channels; per-year table flags 2023/2024 as "thin" (<10 orders) and 2025 as "partial" (137 orders but only 5 distinct months); per-channel table shows each channel's first/last order date. Served by a `coverage` block added to `GET /api/admin/analysis/data-quality` (computed live, 042 views unchanged); mirrored in `public/index.js` + `public/_worker.js`; render logic smoke-tested with real prod data — 8/8 checks passed.)*

## Deliverables

- [x] Historical sales loaded into unified D1. *(404 synced in the full backfill; 493 total after held-record clearance and newly-arrived orders)*
- [x] Reconciliation report. *(Phase_07_08_Reconciliation_2026-09-11.md §8)*
- [x] Known gaps/exceptions list. *(reconciliation §8)*
- [x] Historical coverage metrics. *(reconciliation §8)*

## Verification / Test Checklist

- [x] Duplicate re-run returns unchanged/updated rather than duplicate. *(verified: 458 unchanged with zero writes, and again post-refactor)*
- [x] Multi-item historical orders remain one order header. *(493 orders / 737 items; `orders_with_items` = 493)*
- [x] UNALLOCATED logic preserved. *(737/737 lines `UNALLOCATED` — no invented or equal-split line revenue)*
- [x] Channel totals reconcile within documented differences. *(8 channels sum to 493 orders and THB 1,552,277.63)*
- [x] Failed records are recoverable. *(all 18 held records recovered or explicitly retired with no data loss; none had ever been written to D1)*

## Definition of Done

- [x] Historical data is sufficient for 28-day/90-day trends and participation analysis. *(3+ years, 493 orders, 737 mapped lines)*
- [x] Backfill is reconciled and documented. *(reconciliation §8)*
- [x] Live ongoing sync remains separate and safe. *(Make.com Sales Sync still OFF; Phase 17 Worker is a separate deployable with its own lock and telemetry source)*

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

- [x] Record files changed. *(reconciliation doc + Phase 17 handoff §2)*
- [x] Record migrations/API routes/UI routes created or changed. *(no new API/UI in Phase 08; migration 045 added under Phase 17)*
- [x] Record tests performed and results. *(reconciliation §7 verification log + Phase 17 handoff §6)*
- [x] Record unresolved issues and risks. *(reconciliation §8 + Phase 17 handoff §9)*
- [x] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`. *(09_Handoffs/)*
- [x] Commit only phase-scoped changes with a clear Git commit message. *(Phase 08 closure docs committed in `b2537c2`, 2026-09-18)*
- [x] Prepare a concise handoff for Phase 9 and stop. *(Satisfied by `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md` §8 Phase 08 closure + §9 pointer; next phase chosen by operator was 17, not 09)*

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 08 — Historical Sales Backfill & Reconciliation`

## Droid Working Instruction

> Work on **Phase 08 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
