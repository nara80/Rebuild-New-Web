# Phase 07/08 — Confirmed-Mapping Sync Runbook (v3, revised 2026-09-11)

**Utility:** `scripts/notion-product-mapper.mjs` (Node, no dependencies)
**Design (approved 2026-09-11):** Make.com remains the only system that fixes and confirms product mappings in Notion. This tool never resolves or remaps anything — it syncs **confirmed** mappings into D1.

> Previous versions of this runbook described a resolver-based mapper. That flow is superseded; see `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

## Eligibility rule (enforced by the tool)

A Notion OrderList record is synced only when:
1. `Product_Mapping_Status = "Mapped"` (server-side query filter; empty/Unmapped/Review Required/Partial always belong to Make.com), AND
2. `D1_Current_Signature != D1_Last_Synced_Signature`, or `D1_Last_Synced_Signature` is empty, AND
3. `TotalAmount` exists in Notion (> 0). **Permanent rule (2026-09-12):** revenue data is corrected monthly; records without a total are held (`skipped_no_total`) and re-sync automatically once the total is filled (the signature changes), AND
4. With `--before ISO`: `Order_Date` is before the cutoff and parseable (server-side filter on `Order_Date`/`Order_date01` + client-side defense). Used to hold back months still being corrected — e.g. `--before 2026-08-01` = July 2026 and earlier, since August is being corrected until end of September 2026.

After a successful D1 upsert (live mode), the tool writes `D1_Last_Synced_Signature = D1_Current_Signature` — the only Notion field it ever writes.

## Environment (local session only — never committed, never printed)

Stored in `.dev.vars` (gitignored): `NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, plus `SALES_SYNC_API_TOKEN`. Load into a session:

```powershell
Get-Content .dev.vars | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$' } | ForEach-Object { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2].Trim() }
$env:MAPPER_API_BASE="https://www.mildmate.com"   # or http://localhost:8788 for local tests
```

## CLI reference

| Flag | Purpose |
|---|---|
| `--dry-run` | Read-only: report what would be upserted to D1 and whether the signature would be updated |
| `--limit N` | Stop after N processed records |
| `--resume` | Continue from the saved cursor (`scripts/.notion-mapper-state.json`, gitignored) |
| `--order-id N` | Only the record whose Notion `ID` (unique_id) = N, e.g. `1038` |
| `--edited-after ISO` | Notion-side `last_edited_time` filter |
| `--before ISO-date` | Scope to records with `Order_Date` before the date (e.g. `2026-08-01` = July-and-earlier); server-side + client-side |
| `--input-file f.json` | Offline mock mode (testing only) |

Logs: JSONL per run under `logs/notion-mapper/` (gitignored), token- and PII-free.

## Run report email (2026-09-12 rule)

**Every LIVE-Notion run (dry-run included) emails its outcome summary to `contact@mildmate.com`** (override with `REPORT_EMAIL_TO`). Mock `--input-file` runs never email. Requires `RESEND_API_KEY` in `.dev.vars` — the real key from https://resend.com/api-keys (Cloudflare Pages secrets cannot be read back).

The email contains: run metadata (mode, `--before` scope, log file), the full counter summary (synced / eligible, each skip reason, errors), the synced/eligible order list (shop, order number, total, items as `id×qty`), skip details with order numbers, and error details. Sent as multipart text + HTML, token- and PII-free.

A report failure never fails the sync run — it logs `email_report: failed` to the JSONL and prints a warning.

**Cron cadence (Phase 17, decided):** manual/batch runs email every time; the future cron Worker will email **only when something happened** (synced > 0 or errors) plus a **daily digest** — a 15-minute cron is 96 runs/day, which would exceed Resend's 100/day free tier if every run emailed.

## What gets written to D1 (`POST /api/v1/sales/orders/upsert`)

- Identity: `(source_system = Shop, source_order_id = Order_Number)`; `notion_page_id` included.
- Items parsed from the **confirmed** `D1_Product_Map` (both live formats supported), cross-checked against `D1_Product_IDs`, ids validated against the canonical catalog before any write.
- `source_item_key = {Order_Number}-{n}` — matches the Make.com convention verified in production, so both systems upsert the same rows.
- Exact `TotalAmount` as `order_total`; line revenue `UNALLOCATED` (never invented, never equal-split).
- Thai operational status mapped via an explicit table (e.g. `จัดส่งสินค้า` → `shipped`); unknown statuses are sent without status and flagged, never guessed.

## Verified so far (2026-09-11)

- Notion connection + "OrderList" identity + schema + pagination + filters: ✅ read-only verified.
- Dry-run `--order-id 1038`: ✅ eligible, parsed D1 20 + 26 (matches `D1_Product_IDs`), correct payload, signature update flagged. No writes performed.

## Prerequisites before LIVE runs

1. Approval of the live single-record test.
2. Bundle with `/api/v1/*` mapping/events routes deployed (ships with Phases 04–07); migrations 043 + 044 applied to preview/prod (043/044 support Make.com + audit paths; the sync itself needs the deployed sales upsert route, already live in prod).
3. `MAPPER_API_BASE` pointed at the intended target (local → preview → prod ramp).
4. Make.com Sales Sync schedule remains OFF until the Phase 08 activation decision.

## Live sequence (after approval)

```powershell
# 1. Single confirmed record (the verified known case)
node scripts/notion-product-mapper.mjs --order-id 1038            # live: 1 D1 upsert + signature write-back
# verify in D1 + Notion, re-run to confirm idempotent skip:
node scripts/notion-product-mapper.mjs --order-id 1038            # expect skipped_unchanged

# 2. Controlled batches (dry-run first, review JSONL, then live)
node scripts/notion-product-mapper.mjs --dry-run --limit 5
node scripts/notion-product-mapper.mjs --limit 5
node scripts/notion-product-mapper.mjs --limit 20
node scripts/notion-product-mapper.mjs --limit 20

# 3. Historical backfill scoped to corrected months (2026-09-12 rule set:
#    July 2026 and earlier, TotalAmount required)
node scripts/notion-product-mapper.mjs --dry-run --limit 50 --before 2026-08-01
node scripts/notion-product-mapper.mjs --limit 50 --before 2026-08-01
node scripts/notion-product-mapper.mjs --resume --before 2026-08-01   # full July-and-earlier backlog
```

After each batch: check the run summary (`synced`, `skipped_unchanged`, `skipped_parse_failed`, `skipped_ids_mismatch`, `errors`), spot-check Notion signatures, and reconcile counts in the Data Analyst dashboard.

## Weekly automation (Phase 17, not built)

Decided mechanism: dedicated Cloudflare Worker with a Cron Trigger (Pages cannot cron), holding `NOTION_TOKEN`/`SALES_SYNC_API_TOKEN` as Worker secrets, processing only `Mapped` + signature-changed records. Build only after single-record and small-batch live tests are approved.
