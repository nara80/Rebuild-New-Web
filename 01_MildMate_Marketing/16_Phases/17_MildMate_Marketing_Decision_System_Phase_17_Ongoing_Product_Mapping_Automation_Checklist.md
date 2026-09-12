# MildMate Marketing Decision System — Phase 17
## Ongoing Confirmed-Mapping Sync Automation (v3)

> **Revised 2026-09-12** to match the approved v3 design (`09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`). The original version of this checklist was written for the superseded resolver design. Under v3, **nothing maps products automatically** — Make.com remains the mapping authority in Notion. This phase only automates the *sync* of confirmed `Mapped` records into D1.

**Project root:** `D:/00_mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `master` (Marketing Decision System phases 04–07 merged)  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Dedicated Cloudflare Worker (this phase) — Pages cannot host cron triggers  
**Order system:** Notion `OrderList`  
**Mapping authority:** Make.com (confirms `Product_Mapping_Status = Mapped` + `D1_Product_Map`/`D1_Product_IDs`)  
**Sync engine to automate:** `scripts/notion-product-mapper.mjs` (Phase 07 v3 confirmed-mapping sync CLI)

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate

## Phase Goal

Turn the Phase 07 v3 confirmed-mapping sync CLI into a safe, scheduled, incremental automation so newly confirmed `Mapped` OrderList records flow into D1 continuously without a human running the CLI. The automation never maps, never remaps, and never touches empty/`Unmapped`/`Review Required`/`Partial` records — those remain Make.com's responsibility.

## Approved Design Baseline (inherited from Phase 07 v3)

- Eligibility: `Product_Mapping_Status = "Mapped"` AND (`D1_Current_Signature != D1_Last_Synced_Signature` OR last synced empty).
- After a successful D1 upsert, write back **only** `D1_Last_Synced_Signature`. No other Notion field is ever written.
- `source_item_key = {Order_Number}-{n}` (Make.com-compatible, verified against prod D1).
- Exact order totals; line revenue `UNALLOCATED` (never invented, never equal-split).
- Explicit Thai→canonical status mapping; unknown statuses are sent without status and flagged, never guessed.
- All parsed ids validated against the canonical 32-product catalog; mismatches are skipped and logged.

## Prerequisites / Confirmed Baseline

- [x] Phase 07 v3 sync CLI built; single-record dry-run verified (ID 1038, 2026-09-11).
- [x] Mechanism decided: dedicated Cloudflare Worker + Cron Trigger (Pages cannot cron; repo has a `cron-worker/` precedent).
- [ ] Phase 07 live single-record sync (ID 1038) + idempotent re-run verified.
- [ ] Phase 08 historical backfill executed in controlled batches and reconciled.
- [ ] Migrations 043 + 044 applied to preview and production D1 (044 required if the Worker writes audit events).
- [ ] Dedicated Notion credential confirmed for read + signature write-back (not the read-only historical token).
- [ ] Make.com Sales Sync activation timing decided (stays OFF until that decision).
- [ ] Wrangler/Cloudflare credentials valid for the account (a 2026-09-12 remote-D1 check failed with auth error 7403 — re-authenticate before relying on remote operations).

## Architecture Decision

```text
Dedicated Cloudflare Worker (e.g. mildmate-marketing-sync) + Cron Trigger
      ↓
Query Notion OrderList server-side:
  Product_Mapping_Status = "Mapped"
  AND (D1_Last_Synced_Signature != D1_Current_Signature OR empty)
      ↓
Parse confirmed D1_Product_Map (both live formats)
Cross-check D1_Product_IDs; validate ids vs canonical catalog
      ↓
POST /api/v1/sales/orders/upsert   (Bearer SALES_SYNC_API_TOKEN)
      ↓
Write back only D1_Last_Synced_Signature
      ↓
Audit rows → product_mapping_events (migration 044)
Run telemetry → sync_runs (distinct source, e.g. notion-mapping-sync)
```

Fallback if the cron schedule is not approved: manual Super Admin trigger or a scheduled local run of the existing CLI. Decide explicitly in this phase.

## Task Checklist

### Execution model
- [ ] Decide run frequency (recommended daily at first; tighten only after stability).
- [ ] Create the dedicated Worker with a `scheduled` handler that reuses the CLI's sync logic (port or import the core from `scripts/notion-product-mapper.mjs` — do not fork the logic).
- [ ] Store `NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, `SALES_SYNC_API_TOKEN` as Worker secrets — never in code or repo.
- [ ] Point the upsert target at `https://www.mildmate.com` (`/api/v1/sales/orders/upsert`).

### Incremental processing
- [ ] Server-side `Mapped` filter + signature-difference check (same eligibility as the CLI).
- [ ] Persisted cursor (D1 table or KV) — never in-memory only.
- [ ] Never re-process signature-unchanged records.
- [ ] Never fetch or write non-Mapped statuses (they belong to Make.com).

### Safety and reliability
- [ ] Run lock (D1 row) — skip the run if the previous run is still active.
- [ ] Throttle ~350 ms per Notion call + 429/5xx backoff.
- [ ] Bound records/duration per invocation (carry over via cursor).
- [ ] Catalog validation before any upsert; skip + log mismatches (never guess).
- [ ] Signature write-back only after confirmed upsert success (never partial-write a record).

### Observability
- [ ] Record every scheduled run in `sync_runs` with a distinct source (e.g. `notion-mapping-sync`).
- [ ] Write per-record audit rows to `product_mapping_events` (migration 044).
- [ ] Surface `Review Required`/`Unmapped` counts in the Phase 06 Data Quality & Sync Monitor (owned by Make.com; visible for ops — this phase only reports, never processes).
- [ ] Surface sync freshness in the Data Analyst dashboard Data Quality section.

### Rollout
- [ ] Controlled test: invoke the scheduled handler manually with the schedule OFF.
- [ ] Enable the cron schedule only after the controlled test passes.
- [ ] Document rollback: pause the schedule; fall back to manual CLI runs (runbook already covers this).

## Deliverables

- [ ] Scheduled (or approved alternative) ongoing confirmed-mapping sync.
- [ ] Cursor/incremental query with persisted state.
- [ ] Run lock + throttle/backoff + bounded runs.
- [ ] Run logs + `product_mapping_events` audit integration.
- [ ] Review Required / Unmapped count reporting (report only).
- [ ] Dashboard visibility for sync freshness.
- [ ] Pause/rollback runbook.

## Verification / Test Checklist

- [ ] Newly confirmed `Mapped` record (with signature difference) syncs into D1 within one scheduled cycle, and its `D1_Last_Synced_Signature` is updated.
- [ ] Signature-unchanged record is never re-processed.
- [ ] Empty/`Unmapped`/`Review Required`/`Partial` records are never fetched or written.
- [ ] Cursor resumes correctly after an interrupted run.
- [ ] Two overlapping runs cannot process the same records (lock verified).
- [ ] Simulated 429 → retry/backoff works; run completes.
- [ ] Run rows appear in `sync_runs`; audit rows appear in `product_mapping_events`.
- [ ] No secret and no unnecessary PII appears in any log.
- [ ] Duplicate cycle re-run is idempotent (upsert returns unchanged/updated, never duplicates).
- [ ] Pausing the schedule stops processing cleanly (rollback verified).

## Definition of Done

- [ ] Confirmed `Mapped` orders reach D1 automatically with no human trigger.
- [ ] The automation never maps, never remaps, and never guesses.
- [ ] Runs are observable, idempotent, resumable, and safely pausable.
- [ ] Make.com's mapping workflow and (future) Sales Sync pipeline remain untouched and independent.

## Global Guardrails

- [!] Do not expose `NOTION_TOKEN`, `SALES_SYNC_API_TOKEN`, or any production secret.
- [!] Do not hard-code credentials.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not write any Notion field other than `D1_Last_Synced_Signature`.
- [!] Do not auto-map or remap anything — Make.com is the mapping authority.
- [!] Do not fetch or process empty/`Unmapped`/`Review Required`/`Partial` records.
- [!] Do not overwrite `Product_Info`, `ProductJSON`, `D1_Product_Map`, or `D1_Product_IDs`.
- [!] Do not invent historical line-item revenue; keep unknown revenue `UNALLOCATED`.
- [!] Do not equal-split multi-item order totals.
- [!] Do not modify or replace the existing operational website `orders` system.
- [!] Do not alter the existing Make.com workflows in this phase.
- [!] Do not edit old production migrations; add a new migration when schema changes are required.
- [!] Do not enable the production schedule before the controlled verification passes.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not build future phases early.

## Phase Handoff Rule

- [ ] Record files changed.
- [ ] Record migrations/Worker/cron triggers created or changed.
- [ ] Record Notion fields read/written.
- [ ] Record tests performed and results.
- [ ] Record schedule configuration and rollback procedure.
- [ ] Record unresolved issues and risks.
- [ ] Save implementation summary under `D:/00_mildmate/re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [ ] Stop after this phase is implemented, tested, documented, and ready for review.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 17 — Ongoing Confirmed-Mapping Sync Automation`

## Droid Working Instruction

> Work on **Phase 17 only**. Reuse the Phase 07 v3 sync engine — do not fork or re-design the mapping/sync logic. Confirm all prerequisites above are met before building. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
