> **⚠️ HISTORICAL RECORD (2026-09-11).** Migration 044 and the `/api/v1/mapping/events` routes delivered here remain valid. The CLI described here (resolver-based) was reworked into the v3 **confirmed-mapping sync** (`Mapped`-only + signature rule; writes only `D1_Last_Synced_Signature`). See `Phase_07_08_Reconciliation_2026-09-11.md`.

# Phase 07 v2 Handoff — Direct Notion API Product Mapper (Offline Build)

**Date:** 2026-09-10
**Branch:** `feature/marketing-data-analyst`
**Status:** Offline parts built + tested. Live Notion runs blocked on two user-side items (dedicated token, real data source id). Not deployed.

## Approved decisions (recorded)

1. `product_mapping_events` audit table approved → built as migration 044.
2. Make.com Sales Sync schedule stays **OFF until Phase 08** (historical mapping runs with sync inactive; mapped records flow to D1 during the Phase 08 backfill).
3. Ongoing/scheduled automation deferred to **Phase 17** (checklist committed separately, `fdb99b3`).

## Files changed

| File | Change |
|---|---|
| `migrations/044_product_mapping_events.sql` | New additive audit table (page id, order id, raw text excerpt, previous/resolved ids, method, confidence, result status, dry_run flag) |
| `workers/api/sales.ts` | Schema self-heal for `product_mapping_events`; `POST/GET /api/v1/mapping/events` (Bearer auth; validates method + result status + product id array) |
| `scripts/notion-product-mapper.mjs` | New dependency-free Node CLI: Notion data-source query (API version 2025-09-03) with pagination + `last_edited_time` filter, PII-scoped property reads, best-effort ProductJSON/Product_Info parser, resolve via Worker ladder, Notion PATCH limited to the 3 mapping fields (property types auto-detected), audit events, JSONL logs, `--dry-run/--limit/--resume/--order-id/--edited-after/--input-file`, 350 ms throttle + 429/5xx backoff |
| `public/_worker.js`, `public/index.js` | Rebuilt bundles (633,696 bytes, identical) |
| `.gitignore` | Excludes mapper state file + `logs/` |
| `01_MildMate_Marketing/05_Mapping/Phase_07_Historical_Mapping_Runbook_2026-09-10.md` | Live-run runbook (env, prerequisites, batch sequence 1→5→20→50, corrections loop) |

## Tests performed (local dev server + local D1, migration 044 applied locally)

| Test | Result |
|---|---|
| `POST /api/v1/mapping/events` valid → created; invalid result_status → 400; unauth → 401; GET lists rows | ✅ |
| CLI mock run (5 records, dry-run): known 1038 → `Mapped` `[20,26]`, two map lines in sales-sync parser format | ✅ |
| Variation-exact via alias (qty 2 preserved) → `Mapped` `[3]`, confidence 1.0 EXACT_VARIATION | ✅ |
| Unknown item (Product_Info text fallback) → `Review Required`, no ids written, existing fields not cleared | ✅ |
| Already-`Mapped` record → skipped (verified mapping preserved) | ✅ |
| Multi-item order (1 resolved + 1 unknown) → `Partial` | ✅ |
| All 5 decisions audited in `product_mapping_events` with `dry_run=1` | ✅ |
| JSONL log contains no tokens and no customer PII | ✅ (inspected) |

Not yet testable (blocked): live Notion read/update, real ProductJSON shape, property-type detection against real OrderList, rate-limit behavior at scale, batch resume against live pagination, Make Sales Sync acceptance of newly mapped orders (deferred to Phase 08 by decision).

## Blockers (user-side)

1. Create dedicated Notion token `MildMate OrderList Mapper` (read + update) and grant it OrderList access; provide as `NOTION_TOKEN` env var.
2. Provide real `NOTION_DATA_SOURCE_ID`.

Also before live runs: apply 043 + 044 to preview/prod, deploy the pending bundle (Phases 04–07), load the 16 confirmed Etsy listing aliases.

## Risks

- Parser is calibrated against assumed ProductJSON shapes; first live dry-run (limit 5) will likely require one parser adjustment pass. Unparseable records safely become `Review Required`.
- Notion property types for the 3 mapping fields are auto-detected but unverified against the real database (rich_text/select/status all supported).

## Next steps

1. User provides the two blockers → live connectivity check (`--dry-run --limit 1`), parser calibration, `--order-id 1038 --dry-run`.
2. Controlled batches 5 → 20 → 50 → full backlog with `--resume`; measure coverage; record unresolved `Review Required` records.
3. Then Phase 08 (historical sales backfill + Sales Sync activation).
