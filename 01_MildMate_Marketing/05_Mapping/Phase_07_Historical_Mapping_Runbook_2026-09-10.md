# Phase 07 v2 — Historical Mapping Runbook (Direct Notion API Mapper)

**Utility:** `scripts/notion-product-mapper.mjs` (Node, no dependencies)
**Decisions locked:** audit table approved (migration 044); Make.com Sales Sync schedule stays OFF until Phase 08.

## Environment (local session only — never committed, never printed)

```powershell
$env:NOTION_TOKEN="PRIVATE_TOKEN"                    # dedicated "MildMate OrderList Mapper" (read + update on OrderList)
$env:NOTION_DATA_SOURCE_ID="REAL_ORDERLIST_DATA_SOURCE_ID"
$env:SALES_SYNC_API_TOKEN="PRODUCTION_TOKEN"         # same token as the sales sync
$env:MAPPER_API_BASE="https://www.mildmate.com"      # or http://localhost:8788 for local tests
```

## Prerequisites (must all be true before live runs)

1. Migrations **043 + 044** applied to preview and production D1.
2. Worker bundle with `/api/v1/mapping/*` deployed (ships with Phases 04–07).
3. Dedicated Notion token created and granted access to OrderList.
4. Make.com Sales Sync schedule **OFF** (stays off until Phase 08 per decision).
5. The 16 confirmed Etsy listing mappings loaded via `POST /api/v1/mapping/aliases`.

## CLI reference

| Flag | Purpose |
|---|---|
| `--dry-run` | Resolve + log + audit-event only; **no Notion writes** |
| `--limit N` | Stop after N processed records |
| `--resume` | Continue from the saved cursor (`scripts/.notion-mapper-state.json`, gitignored) |
| `--order-id X` | Process only the record whose `Order_Number` = X |
| `--edited-after ISO` | Notion-side filter on `last_edited_time` |
| `--input-file f.json` | Offline mock mode (no Notion access; used for testing) |

Logs: JSONL per run under `logs/notion-mapper/` (gitignored) + console summary. Audit rows land in D1 `product_mapping_events` (dry runs flagged `dry_run=1`).

## Behavior guarantees

- Records already `Mapped` are skipped (verified mappings preserved).
- Only `D1_Product_IDs`, `D1_Product_Map`, `Product_Mapping_Status` are written; property types are detected from the page itself. `Product_Info`/`ProductJSON` are never modified.
- `Review Required` writes only the status — existing D1 fields are not cleared.
- Rollup: all items resolved → `Mapped`; some → `Partial`; none → `Review Required`. No guessing; no AI in the current build (deterministic ladder only via `/api/v1/mapping/resolve`).
- Multi-product listings expand to one `D1_Product_Map` line per product id (sales-sync parser format).
- Notion rate limit: 350 ms throttle + retry/backoff on 429/5xx (max 5 retries).
- Confidence: EXACT_VARIATION 1.0 · EXACT_ALIAS 0.97 · LISTING_VARIATION 0.9. Order confidence = worst item.

## Recommended live sequence

```powershell
# 1. Connectivity check + first look at real data shape (no writes)
node scripts/notion-product-mapper.mjs --dry-run --limit 1

# 2. Verify the known case (no writes)
node scripts/notion-product-mapper.mjs --order-id 1038 --dry-run

# 3. Controlled batches — dry-run first, review the JSONL log, then live
node scripts/notion-product-mapper.mjs --dry-run --limit 5
node scripts/notion-product-mapper.mjs --limit 5
# verify the 5 records in Notion (only 3 fields changed), then:
node scripts/notion-product-mapper.mjs --limit 20
node scripts/notion-product-mapper.mjs --limit 50
# full backlog with resume support:
node scripts/notion-product-mapper.mjs --resume
```

After each batch: check `Review Required` counts in the run summary and mapping coverage on the Data Analyst dashboard (after Phase 08 sync activation, D1-side coverage becomes meaningful).

## Important caveat — parser calibration

The `ProductJSON` / `Product_Info` parser is **best-effort against assumed shapes** (JSON array of items with `listing_id`/`variation`/`title`/`quantity`-style keys; plain-text fallback one item per line). The first live `--dry-run --limit 5` will reveal the real field shapes; expect one parser adjustment pass before batch runs. Unparseable records safely become `Review Required`, never a guess.

## Human corrections loop

For each `Review Required` record a human resolves, store the correction as reusable memory:

```powershell
# example
Invoke-WebRequest -Uri "$env:MAPPER_API_BASE/api/v1/mapping/aliases" -Method POST `
  -Headers @{ Authorization = "Bearer $env:SALES_SYNC_API_TOKEN"; 'Content-Type'='application/json' } `
  -Body '{"source_system":"etsy","listing_id":"...","alias_text":"...exact variation text...","product_ids":[3],"match_scope":"variation","notes":"human correction"}'
```

Then re-run the mapper for that record: `--order-id <Order_Number>`.
