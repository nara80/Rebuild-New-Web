> **⚠️ REVISION REQUIRED WHEN REACHED (2026-09-11).** Written for the superseded resolver design. Under the approved v3 design, weekly automation runs the **confirmed-mapping sync** (`Mapped` + `D1_Current_Signature != D1_Last_Synced_Signature` only; writes back only `D1_Last_Synced_Signature`; never remaps). Decided mechanism: dedicated Cloudflare Worker + Cron Trigger (Pages cannot cron). See `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

# MildMate Marketing Decision System — Phase 17
## Ongoing Product Mapping Automation

**Project root:** `D:/00_Mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `feature/marketing-data-analyst`  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Existing Cloudflare Pages project  
**Order system:** Notion `OrderList`  
**Product mapping integration:** Direct Notion API (built in Phase 07)  
**Ongoing sales sync:** Existing Make.com `Notion OrderList → D1 Sales Sync`

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate

## Phase Goal

Turn the Phase 07 direct Notion product mapper from a manually executed batch utility into a safe, scheduled, incremental automation so new `OrderList` records are mapped continuously without human triggering.

## Prerequisites / Confirmed Baseline

- [x] Phase 07 direct Notion API product mapper built and historically verified (batch mode, dry-run, resume).
- [x] `product_mapping_aliases` mapping memory live in production D1 (migration 043).
- [x] `product_mapping_events` audit table live in production D1 (migration 044).
- [x] Dedicated Notion credential (`MildMate OrderList Mapper`) with read + update access to OrderList.
- [x] Phase 08 historical sales backfill completed; Make.com Sales Sync activated (`From now on`, every 15 minutes).
- [x] Mapping coverage visible in the Data Analyst dashboard (Phases 05–06).

## Architecture Decision

Recommended long-term execution (from Phase 07 plan):

```text
Cloudflare Worker Cron (scheduled)
      ↓
Query Notion OrderList (last_edited_time cursor, eligible statuses only)
      ↓
Product Mapping Resolver (existing /api/v1/mapping/* engine)
      ↓
Update Notion mapping fields
      ↓
Log run + audit events
      ↓
Mapped records flow into existing Make.com Sales Sync
```

Fallback option if Cron is not approved: manual Super Admin action or a scheduled local utility. Decide explicitly in this phase.

## Task Checklist

### Execution model
- [ ] Decide execution model: Cloudflare Cron (recommended) vs manual admin action vs scheduled local utility.
- [ ] Decide run frequency (recommended: every 15–30 minutes, aligned with the Make.com Sales Sync cadence).
- [ ] Store `NOTION_TOKEN` and `NOTION_DATA_SOURCE_ID` as Cloudflare secrets (Pages project) — never in code or repo.

### Incremental processing
- [ ] Query only new/changed records needing mapping (`Product_Mapping_Status` ∈ empty/`Unmapped`/`Review Required`).
- [ ] Use `last_edited_time` / persisted cursor strategy (cursor stored in D1, not in memory).
- [ ] Never re-process records already `Mapped` (preserve verified mappings).
- [ ] Skip records currently pending human review unless explicitly included by configuration.

### Safety and reliability
- [ ] Handle Notion API rate limits (~3 req/s): throttle + 429 retry with backoff.
- [ ] Handle transient errors safely (retry bounded, then log and continue; never partial-write a record's mapping fields).
- [ ] Prevent concurrent duplicate processing (run lock in D1; skip run if previous run still active).
- [ ] Validate all resolved Product_IDs against the canonical catalog before any Notion write.
- [ ] Keep confidence rules from Phase 07: deterministic evidence auto-maps; below threshold → `Review Required`; AI never invents Product_ID.

### Observability
- [ ] Record every scheduled run in a run log (reuse `sync_runs` with a distinct `source`, e.g. `notion-product-mapper`, or equivalent).
- [ ] Write per-record audit rows to `product_mapping_events`.
- [ ] Add a `Review Required` report/alert path (at minimum: count surfaced in the Data Quality & Sync Monitor; optionally an email/notification).
- [ ] Surface mapper run freshness in the Data Analyst dashboard Data Quality section.

### Rollout
- [ ] Production-test with a controlled set (schedule OFF, manual trigger of the scheduled handler first).
- [ ] Enable the schedule only after the controlled test passes.
- [ ] Document rollback: how to pause the schedule and fall back to manual batch mode.

## Deliverables

- [ ] Scheduled (or approved alternative) ongoing mapping execution.
- [ ] Cursor/incremental query implementation with persisted state.
- [ ] Run lock + rate-limit + retry handling.
- [ ] Run logs + `product_mapping_events` audit integration.
- [ ] Review Required alert/report.
- [ ] Dashboard visibility for mapper freshness/coverage.
- [ ] Rollback/pause runbook.

## Verification / Test Checklist

- [ ] New unmapped Notion record is mapped automatically within one scheduled cycle.
- [ ] Already-`Mapped` record is never re-processed.
- [ ] `Review Required` record stays untouched by normal runs and appears in the report.
- [ ] Cursor resumes correctly after an interrupted run.
- [ ] Two overlapping runs cannot process the same records (lock verified).
- [ ] Simulated 429 → retry/backoff works; run completes.
- [ ] Run rows appear in the run log; audit rows appear in `product_mapping_events`.
- [ ] No secret and no unnecessary PII appears in any log.
- [ ] Newly mapped records flow into the existing Make.com Sales Sync unchanged.
- [ ] Pausing the schedule stops processing cleanly (rollback verified).

## Definition of Done

- [ ] New eligible OrderList records reach `Mapped` automatically with strong evidence, with no human trigger.
- [ ] Ambiguous records are never silently guessed and are visibly reported.
- [ ] Runs are observable, idempotent, resumable, and safely pausable.
- [ ] The existing Make.com Sales Sync continues downstream unchanged.

## Global Guardrails

- [!] Do not expose `NOTION_TOKEN`, `SALES_SYNC_API_TOKEN`, or any production secret.
- [!] Do not hard-code credentials.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not let AI invent Product_ID.
- [!] Do not use parent listing title when selected variation conflicts.
- [!] Do not overwrite verified mappings during normal processing.
- [!] Do not overwrite `Product_Info` or `ProductJSON`.
- [!] Do not modify unrelated OrderList properties (customer, shipping, totals, dates, notes, operational status).
- [!] Do not modify or replace the existing operational website `orders` system.
- [!] Do not remove or alter the existing Make.com Sales Sync in this phase.
- [!] Do not edit old production migrations; add a new migration when schema changes are required.
- [!] Do not enable the production schedule before the controlled verification passes.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not build future phases early.

## Phase Handoff Rule

- [ ] Record files changed.
- [ ] Record migrations/API routes/cron triggers created or changed.
- [ ] Record Notion fields read/written.
- [ ] Record tests performed and results.
- [ ] Record schedule configuration and rollback procedure.
- [ ] Record unresolved issues and risks.
- [ ] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [ ] Stop after this phase is implemented, tested, documented, and ready for review.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 17 — Ongoing Product Mapping Automation`

## Droid Working Instruction

> Work on **Phase 17 only**. Inspect existing code before changing it. Reuse the Phase 07 mapper and resolver — do not fork the mapping logic. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
