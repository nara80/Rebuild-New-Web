# Phase 17 Handoff — Ongoing Confirmed-Mapping Sync Automation

**Date:** 2026-09-18
**Branch:** `master`
**Status:** Built + locally verified. **Not deployed** — production deploy and schedule activation await explicit user approval (Phase 17 guardrail).

---

## 1. What was built

The Phase 07 v3 sync CLI now runs unattended on a Cloudflare Worker cron. Newly confirmed `Mapped` OrderList records reach D1 without a human running anything.

The central design decision: rather than copy the CLI's logic into a Worker (which would guarantee drift in the most fragile part of the system — the three-format map parser), the runtime-agnostic logic was **extracted into a shared engine that both runtimes import**. The checklist rule "port or import the core — do not fork the logic" is satisfied structurally, not by discipline.

```
scripts/notion-mapper-core.mjs        ← single implementation (fetch/JSON/Date only)
   ├── imported by scripts/notion-product-mapper.mjs   (Node CLI, manual runs)
   └── imported by marketing-sync-worker/index.js      (Worker cron, scheduled runs)
```

The CLI shrank from **686 to ~210 lines** and now supplies only Node-specific concerns: CLI flags, JSONL file logs, the on-disk cursor file, `process.env` wiring, and offline mock mode. The Worker supplies D1-backed equivalents.

---

## 2. Files changed

| File | Change |
|---|---|
| `scripts/notion-mapper-core.mjs` | **New.** Shared engine: config, Thai status map, three-format parser, Notion read/signature-write, catalog validation, upsert payload builder, `processRecord`, report email builder, and a new shared `runSync()` orchestration loop with injected `log` / `onCursor` / `onEvent` / `maxMs`. |
| `scripts/notion-product-mapper.mjs` | Reduced to a Node CLI shell over the core. Re-exports `parseConfirmedMap` / `parseConfirmedIds` so existing tooling that imported them from this path keeps working. Behaviour unchanged. |
| `scripts/notion-mapper-parser.test.mjs` | **New.** 27-case parser regression suite built from real production map values. Runs on plain `node`, no test framework. `PARSER_IMPORT` env var lets the same suite verify CLI and core are identical. |
| `marketing-sync-worker/index.js` | **New.** Scheduled Worker: cron dispatch, D1 lock/cursor/state, `sync_runs` telemetry, `product_mapping_events` audit batch, conditional report email, and an authenticated manual `/run` + `/status` endpoint for controlled testing. |
| `marketing-sync-worker/wrangler.toml` | **New.** Worker config, cron triggers, **production** D1 binding, date-scope vars. |
| `migrations/045_marketing_sync_state.sql` | **New.** `marketing_sync_state` (cursor + run bookkeeping) and `marketing_sync_lock` (expiry-based mutual exclusion), both seeded. Additive only. |

Migrations 043 + 044 were already applied to production in a prior session; **045 is not yet applied to production.**

---

## 3. Notion fields read / written

Unchanged from Phase 07 v3, and deliberately so.

- **Read:** `ID`, `Order_Number`, `Shop`, `Status`, `Order_Date` / `Order_date01`, `TotalAmount`, `Product_Mapping_Status`, `D1_Product_IDs`, `D1_Product_Map`, `D1_Current_Signature`, `D1_Last_Synced_Signature`.
- **Written:** `D1_Last_Synced_Signature` only, and only after a confirmed successful D1 upsert.
- Only `Product_Mapping_Status = "Mapped"` records are ever fetched (server-side filter). Empty / `Unmapped` / `Review Required` / `Partial` remain Make.com's.

---

## 4. Schedule configuration

```toml
crons = ["0 2 1,15 * *", "0 * * * *"]
```

**Cadence decision (user, 2026-09-17): every 2 weeks.** Cron syntax cannot express a true 14-day interval, so the main pass runs the **1st and 15th at 02:00 UTC (09:00 Bangkok)** — deterministic, twice-monthly, and requiring no extra state to track alternation.

The second, hourly trigger is a **drain**, not a second sync. It returns immediately unless the previous run stopped bounded with carry-over work (`last_status = 'partial'`). Without it, a batch too large for one invocation would wait a fortnight to finish. Verified: with `last_status = 'success'` the drain writes no `sync_runs` row at all.

**Email cadence follows from this.** A report is sent only when a pass completes (`exhausted`) or something errored; mid-batch drain runs stay silent. At two passes per month this is ~2 emails/month, so the Resend free-tier concern that shaped the earlier design (96 runs/day vs 100 emails/day) no longer applies and the planned digest complexity was dropped.

### Date scope — derived, not hard-coded

`resolveBefore()` encodes the operator's stated correction cadence: month M is finalised in Notion during month M+1 (August is corrected by end of September). So the cutoff is the **first day of the previous month**, computed per run.

Verified on 2026-09-18 the Worker resolved `before = 2026-08-01` — exactly the cutoff used manually throughout the Phase 08 backfill. Overrides: `SYNC_BEFORE_MODE = "none"` (rely only on the TotalAmount rule) or `SYNC_BEFORE_FIXED = "YYYY-MM-DD"`.

This means **August 2026 will begin syncing automatically on the 1 October run** — no manual re-scoping needed, which retires the "end of September" reminder from the Phase 08 backlog.

---

## 5. Safety mechanisms

| Concern | Mechanism |
|---|---|
| Overlapping runs | `marketing_sync_lock` acquired by a single atomic `UPDATE … WHERE locked_until IS NULL OR locked_until < now`. The `WHERE` clause *is* the mutual-exclusion test, so two invocations cannot both see it free. |
| Crashed run deadlocking the schedule | `locked_until` is a 10-minute expiry, not a boolean flag. A dead holder's lock is reclaimable. |
| Run exceeding platform limits | `maxMs` (default 180 s) stops cleanly between pages and carries over via the cursor. |
| Losing place mid-scan | Cursor persisted in D1 after every page. On a completed pass it resets to `NULL` so the next run rescans from the top and picks up newly-corrected records anywhere in the table. |
| Records skipped by a record limit | When `limit` stops a run mid-page the cursor is deliberately **not** advanced, so the next run re-reads that page (idempotent) instead of skipping its remainder. |
| Guessing a mapping | Catalog validation before any upsert; parse failures, id mismatches, and invalid ids are skipped and logged. Nothing is inferred. |
| Partial writes | Signature write-back happens only after a confirmed successful upsert. |
| Secret exposure | All credentials come from Worker secrets; the Worker logger emits only record ids, skip reasons, and counters. |
| Report failure breaking a sync | Email is wrapped; a failure is recorded and never fails the run. |
| Audit failure breaking a sync | `product_mapping_events` flush is wrapped — observability never affects correctness. |

---

## 6. Tests performed and results

### Parser regression — 27 cases, all real production values

`node scripts/notion-mapper-parser.test.mjs`

Covers format A (semicolon + newline, `Status` suffixes, comma-containing titles, missing `Qty`, 5-item web order, etsy repeat-id lines), format B (standalone `MildMate -> id`), format C (arrow terminating a Thai description piece), stray `| Mapped` / `Mapped` / `Status Mapped` fragment lines, and the must-fail set (empty, null, `Review Required | No Parsed Item`, multi-id with `,` and `&`, unrecognised shapes, and the real `tem 4` typo from record 630).

| Target | Result |
|---|---|
| Original CLI (baseline, captured before any edit) | **27 / 27 PASS** |
| Extracted core | **27 / 27 PASS** |
| CLI via its re-export path | **27 / 27 PASS** |

The baseline was captured *first*, deliberately, so the refactor of a pipeline already carrying 487 live orders could be proven behaviour-preserving rather than assumed to be.

### CLI behaviour after refactor (production Notion, read-only)

| Run | Result |
|---|---|
| `--dry-run --before 2026-08-01 --limit 25` | `skipped_unchanged: 25`, 0 errors |
| `--dry-run --before 2026-08-01 --limit 10` (after the `hitLimit` fix) | `skipped_unchanged: 10`, 0 errors |

Both confirm the July-and-earlier scope is fully synced and idempotent, and that the refactor changed nothing operationally.

### Worker — controlled test, schedule OFF, local D1, dry-run only

Run via `wrangler dev --port 8799 --test-scheduled` against a **local** D1 simulation seeded with migrations 039, 044, 045. Notion was read live (read-only); no upserts, no signature writes, no email.

| Check | Result |
|---|---|
| Bundle validates, core import resolves, prod binding correct | `wrangler deploy --dry-run` — 34.12 KiB, `env.DB (mildmate-db-prod)` |
| Unauthenticated request rejected | `401` |
| `/status` reports state, lock, last run, resolved scope | OK — `resolved_before: 2026-08-01` |
| Dry-run sync through the Worker | `processed 5, skipped_unchanged 5, exhausted true, email null` |
| `sync_runs` row written with distinct source | `notion-mapping-sync` / `phase17-…:manual` / `success` / 5 received / 5 unchanged |
| Run refused while lock held | `{ skipped: "locked" }` |
| Expired lock reclaimable (no deadlock) | Run proceeded normally |
| Drain no-ops when nothing to drain | `sync_runs` count unchanged (2 → 2) |
| Cursor carry-over across bounded runs | Pass 1: 50 processed, `exhausted false`, cursor saved. Pass 2: resumed, 50 more, cursor advanced. |

### Bug found and fixed during testing

Hitting a record `limit` reported `exhausted: true`, which reset the cursor to `NULL`. Harmless for scheduled runs (they never set a limit) but wrong for an operator paging through with `/run?limit=N`. Fixed in the core with a `hitLimit` flag; re-verified (`limit=3` → `exhausted: false`, `status: partial`, cursor retained).

### Not yet tested

- **Simulated 429 → backoff.** The retry path is inherited unchanged from the CLI (which survived 476 records across the full backfill), but it was not fault-injected in this phase.
- **Live scheduled run end-to-end**, including a real upsert, signature write-back and report email. Deliberately not fired: the scheduled path runs non-dry, so triggering it would have written to production and consumed Resend quota without approval.

---

## 7. Deploy procedure (user-controlled — nothing below has been run)

```powershell
# 1. Apply migration 045 to production D1 (additive: 2 new tables + 2 seed rows)
cd D:\00_mildmate\re-build_web
npx wrangler d1 execute mildmate-db-prod --remote --file migrations\045_marketing_sync_state.sql

# 2. Set Worker secrets (interactive prompts — values are never echoed)
cd marketing-sync-worker
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put NOTION_DATA_SOURCE_ID
npx wrangler secret put SALES_SYNC_API_TOKEN
npx wrangler secret put RESEND_API_KEY

# 3. Deploy
npx wrangler deploy

# 4. Controlled production test with the schedule effectively idle
#    (dry-run first, then a small live batch)
curl.exe -X POST -H "Authorization: Bearer <SALES_SYNC_API_TOKEN>" `
  "https://mildmate-marketing-sync.<subdomain>.workers.dev/run?dry=1&limit=5"
```

Deploying registers the cron triggers, so step 4 should follow promptly. To hold the schedule inert while testing, comment out the `[triggers]` block for the first deploy and re-add it once the production dry-run looks right.

---

## 8. Rollback

1. **Pause:** remove or comment the `[triggers]` block in `marketing-sync-worker/wrangler.toml` and redeploy, or disable the cron in the Cloudflare dashboard.
2. **Fall back:** the manual CLI is unchanged and fully operational — `node scripts/notion-product-mapper.mjs --before <date> --limit N`.
3. **Full removal:** `npx wrangler delete` in `marketing-sync-worker/`. The two tables from migration 045 are additive and can be left in place harmlessly.
4. Pausing is clean by construction: state lives in D1, work is idempotent, and a paused schedule simply stops acquiring the lock. No in-flight record can be left half-written, because signature write-back only follows a confirmed upsert.

---

## 9. Unresolved issues and risks

1. **Deploy + schedule activation still pending user approval** (Phase 17 guardrail). Nothing has touched production.
2. **Migration 045 not yet applied to production.**
3. **Make.com Sales Sync remains OFF** (user decision 2026-09-17: keep OFF until the Worker is stable). Both systems write the same tables using the same `source_item_key` convention, so they would converge rather than duplicate — but this has never been exercised concurrently, and the lock protects only this Worker against itself, not against Make.com.
4. **Price-as-quantity corruption on 2 Line orders** (§8 of the reconciliation doc) — inflates unit counts, does not affect revenue. Needs a Notion-side fix; will re-sync automatically.
5. **Wrangler OAuth has dropped intermittently** in past sessions. The authenticated sales read API is the wrangler-free verification fallback.
6. **`compatibility_date` pinned to `2026-06-18`**, the newest date the installed wrangler 4.100.0 runtime supports. Raise it only alongside a wrangler upgrade or `wrangler dev` will refuse to start.
7. **Deferred checklist items** (not built, by scope): surfacing `Review Required` / `Unmapped` counts in the Phase 06 Data Quality monitor, and sync freshness in the Data Analyst dashboard. Both are report-only UI additions on top of data this phase already writes (`sync_runs`, `marketing_sync_state`).
8. **`cron-worker/` points at the preview D1** (`mildmate-db`) while this Worker points at production. Pre-existing and out of scope, but worth knowing when comparing the two configs.
