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
- [x] Phase 07 live single-record sync (ID 1038) + idempotent re-run verified. *(2026-09-12: prod upsert `sales_orders` id 9 + signature write-back; re-run returned `skipped_unchanged` with zero writes)*
- [x] Phase 08 historical backfill executed in controlled batches and reconciled. *(2026-09-18: 493 orders / 737 items reconciled; all 18 held records resolved; report in Phase_07_08_Reconciliation §8)*
- [x] Migrations 043 + 044 applied to production D1. *(verified 2026-09-12: alias seed 1038→[20,26] present; events table live, 0 rows; preview optional)*
- [x] Dedicated Notion credential confirmed for read + signature write-back (not the read-only historical token). *(the credential in use performed 487 signature write-backs during Phase 08; reused as a Worker secret)*
- [x] Make.com Sales Sync activation timing decided (stays OFF until that decision; last prod run 2026-09-07, confirmed OFF). *(user decision 2026-09-17: keep OFF until the Worker is stable)*
- [x] Wrangler/Cloudflare credentials valid for the account. *(re-authenticated 2026-09-12; read-only prod verification passed)*

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
- [x] Decide run frequency (recommended daily at first; tighten only after stability). *(user decision 2026-09-17: every 2 weeks -> cron "0 2 1,15 * *" (1st + 15th, 09:00 Bangkok) + hourly drain that no-ops unless carry-over work exists)*
- [x] Create the dedicated Worker with a `scheduled` handler that reuses the CLI's sync logic (port or import the core from `scripts/notion-product-mapper.mjs` — do not fork the logic). *(logic extracted to `scripts/notion-mapper-core.mjs`; imported by BOTH the CLI and `marketing-sync-worker/index.js` — structurally impossible to fork. CLI 686 -> ~210 lines.)*
- [x] Store `NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, `SALES_SYNC_API_TOKEN` as Worker secrets — never in code or repo. *(Verified 2026-09-19 via `wrangler secret list`: all 4 secrets set incl. `RESEND_API_KEY`)*
- [x] Point the upsert target at `https://www.mildmate.com` (`/api/v1/sales/orders/upsert`). *(`MAPPER_API_BASE` var)*

### Incremental processing
- [x] Server-side `Mapped` filter + signature-difference check (same eligibility as the CLI). *(identical code path — shared core)*
- [x] Persisted cursor (D1 table or KV) — never in-memory only. *(`marketing_sync_state`, migration 045; carry-over verified across two bounded passes)*
- [x] Never re-process signature-unchanged records. *(verified: 25 and 10 record dry-runs returned all `skipped_unchanged`)*
- [x] Never fetch or write non-Mapped statuses (they belong to Make.com). *(server-side filter; the 6 status-flipped records are now excluded automatically)*

### Safety and reliability
- [x] Run lock (D1 row) — skip the run if the previous run is still active. *(single atomic UPDATE; verified held -> `{skipped:"locked"}` and expired -> reclaimed, so a crashed run cannot deadlock)*
- [x] Throttle ~350 ms per Notion call + 429/5xx backoff. *(inherited unchanged from the core; 429 not fault-injected in this phase — see handoff §6)*
- [x] Bound records/duration per invocation (carry over via cursor). *(`maxMs`, default 180s; stops between pages. Bug found + fixed: a record `limit` wrongly reported `exhausted`, resetting the cursor.)*
- [x] Catalog validation before any upsert; skip + log mismatches (never guess). *(shared core; 32-product catalog fetched per run)*
- [x] Signature write-back only after confirmed upsert success (never partial-write a record). *(unchanged from Phase 07 v3)*

### Observability
- [x] Record every scheduled run in `sync_runs` with a distinct source (e.g. `notion-mapping-sync`). *(verified row: source `notion-mapping-sync`, scenario `phase17-...:manual`, success, 5 received / 5 unchanged)*
- [x] Write per-record audit rows to `product_mapping_events` (migration 044). *(buffered during the run, flushed in one `db.batch()`; wrapped so audit failure never fails a completed sync)*
- [ ] Surface `Review Required`/`Unmapped` counts in the Phase 06 Data Quality & Sync Monitor (owned by Make.com; visible for ops — this phase only reports, never processes).
- [ ] Surface sync freshness in the Data Analyst dashboard Data Quality section. *(Source Freshness table already exists (Phase 06); it will show `notion-mapping-sync` automatically once the Worker writes its first `sync_runs` row — verify after first successful run)*

### Rollout
- [x] Controlled test: invoke the scheduled handler manually with the schedule OFF. *(local D1 + dry-run + authenticated `/run` endpoint; 9 checks passed — handoff §6)*
- [ ] Enable the cron schedule only after the controlled test passes. *(GAP 2026-09-19: crons went live with the deploy, but the controlled production test has NOT passed — migration 045 is missing in prod, so every invocation currently fails safe at `loadState()`)*
- [x] Document rollback: pause the schedule; fall back to manual CLI runs (runbook already covers this). *(handoff §8)*

## Deliverables

- [x] Scheduled (or approved alternative) ongoing confirmed-mapping sync. *(built; deploy pending approval)*
- [x] Cursor/incremental query with persisted state.
- [x] Run lock + throttle/backoff + bounded runs.
- [x] Run logs + `product_mapping_events` audit integration.
- [ ] Review Required / Unmapped count reporting (report only).
- [ ] Dashboard visibility for sync freshness.
- [x] Pause/rollback runbook. *(handoff §8)*

## Verification / Test Checklist

- [ ] Newly confirmed `Mapped` record (with signature difference) syncs into D1 within one scheduled cycle, and its `D1_Last_Synced_Signature` is updated.
- [x] Signature-unchanged record is never re-processed. *(verified)*
- [x] Empty/`Unmapped`/`Review Required`/`Partial` records are never fetched or written. *(verified via server-side filter)*
- [x] Cursor resumes correctly after an interrupted run. *(verified: pass 1 stopped bounded at 50 with cursor saved; pass 2 resumed and advanced)*
- [x] Two overlapping runs cannot process the same records (lock verified). *(held lock -> run refused; expired lock -> reclaimed)*
- [ ] Simulated 429 → retry/backoff works; run completes.
- [x] Run rows appear in `sync_runs`; audit rows appear in `product_mapping_events`. *(sync_runs verified; audit path exercised via `onEvent` — no eligible records existed locally to write rows, all were `skipped_unchanged`)*
- [x] No secret and no unnecessary PII appears in any log. *(Worker logger emits only record ids, skip reasons, counters)*
- [x] Duplicate cycle re-run is idempotent (upsert returns unchanged/updated, never duplicates). *(verified repeatedly across Phase 08 + post-refactor runs)*
- [ ] Pausing the schedule stops processing cleanly (rollback verified).

## Definition of Done

- [ ] Confirmed `Mapped` orders reach D1 automatically with no human trigger.
- [x] The automation never maps, never remaps, and never guesses. *(27-case parser suite includes a must-fail set; the real `tem 4` typo on record 630 was correctly refused rather than guessed)*
- [x] Runs are observable, idempotent, resumable, and safely pausable.
- [x] Make.com's mapping workflow and (future) Sales Sync pipeline remain untouched and independent. *(no Make.com scenario altered; Sales Sync still OFF)*

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

- [x] Record files changed. *(handoff §2)*
- [x] Record migrations/Worker/cron triggers created or changed. *(handoff §2, §4)*
- [x] Record Notion fields read/written. *(handoff §3)*
- [x] Record tests performed and results. *(handoff §6)*
- [x] Record schedule configuration and rollback procedure. *(handoff §4, §8)*
- [x] Record unresolved issues and risks. *(handoff §9)*
- [x] Save implementation summary under `D:/00_mildmate/re-build_web/01_MildMate_Marketing/`. *(09_Handoffs/Phase_17_Handoff_Scheduled_Confirmed_Mapping_Sync_2026-09-18.md)*
- [x] Commit only phase-scoped changes with a clear Git commit message. *(`b2537c2`, 2026-09-18: worker + core + tests + migration 045 + docs)*
- [ ] Stop after this phase is implemented, tested, documented, and ready for review.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 17 — Ongoing Confirmed-Mapping Sync Automation`

## Droid Working Instruction

> Work on **Phase 17 only**. Reuse the Phase 07 v3 sync engine — do not fork or re-design the mapping/sync logic. Confirm all prerequisites above are met before building. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Deployment Reconciliation Note (2026-09-19)

**Worker deployed but NOT yet operational.** Verified against Cloudflare + production D1 on 2026-09-19:

- Deployed 2026-09-19T00:24Z, version `957956a5` (`mildmate-marketing-sync`); all 4 secrets set (`NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, `SALES_SYNC_API_TOKEN`, `RESEND_API_KEY`).
- **`migrations/045_marketing_sync_state.sql` was never applied to production** — `marketing_sync_state` and `marketing_sync_lock` do not exist in `mildmate-db-prod`. Every scheduled/drain invocation therefore throws at `loadState()`. Failure mode is safe (error is caught, no writes occur), but the Worker does nothing.
- Confirmed impact: **zero `notion-mapping-sync` rows** in prod `sync_runs` (only `notion-direct-mapper` ×490, latest 2026-09-14; `notion-orderlist` ×12, latest 2026-09-07 — Make.com Sales Sync remains OFF as decided).
- **Required to go live:** (1) `npx wrangler d1 execute mildmate-db-prod --remote --file migrations\045_marketing_sync_state.sql` (additive: 2 tables + 2 seed rows); (2) controlled test `POST /run?dry=1&limit=5` with bearer `SALES_SYNC_API_TOKEN`; (3) confirm a `notion-mapping-sync` row lands in `sync_runs`; (4) then allow the next scheduled cycle (1st/15th 02:00 UTC main, hourly drain) to run live.