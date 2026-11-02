# Phase 06 Handoff — Data Quality & Sync Monitor

**Date:** 2026-09-10
**Branch:** `feature/marketing-data-analyst`
**Status:** Built + locally tested. Not deployed (deploy is user-triggered, combined with Phases 04–05).

## Goal

Make data reliability visible before using the data for marketing decisions: sync health, freshness, mapping/coverage gaps, and safe drill-down to affected records — all without SQL.

## Files changed

| File | Change |
|---|---|
| `workers/api/admin-analysis.ts` | Extended `getDataQuality`; new `getExceptions` + `EXCEPTION_TYPES`; route `/data-quality/exceptions` registered |
| `public/super-admin/marketing/data-analyst/index.html` | New "Data Quality & Sync Monitor" card (exception chips, drill-down panel, Recent Sync Runs table, Source Freshness by Channel table) + JS (`renderDQChips`, `loadException`, `closeException`, `renderSyncRuns`, `renderFreshness`) |
| `public/_worker.js`, `public/index.js` | Rebuilt runtime bundles (618,989 bytes, identical) — runtime-parity rule |
| `01_MildMate_Marketing/04_API/Phase_04_Analysis_API_Reference_2026-09-07.md` | Documented Phase 06 response additions + exceptions endpoint |

No migrations. The 042 view is frozen; Phase 06 counts that the view lacks (zero-total orders) are computed live in the API.

## API changes

### `GET /api/admin/analysis/data-quality` (extended)
- `data_quality.zero_total_orders` — commercial orders with `order_total IS NULL OR <= 0` (live query)
- New warning line when zero-total orders exist
- `thresholds` — documented freshness rules: warning when last successful sync > 30 min old (expected Make.com cadence 15 min); critical when no successful sync, last run failed, or invalid product refs exist
- `recent_runs[]` — last 10 `sync_runs` (id, source, scenario, started/finished, status, record counters, `error_message` truncated to 300 chars)
- `channel_freshness[]` — per `channel_norm`: `last_order_day`, `days_since_last_order`, `orders`

### `GET /api/admin/analysis/data-quality/exceptions?type=...` (new)
PII-free drill-downs, each `LIMIT 100` with `truncated` flag. Types:

| type | Records |
|---|---|
| `missing_product_id` | Active items on commercial orders without a Product_ID |
| `unmapped_orders` | Commercial orders where no item has a Product_ID |
| `itemless_orders` | Commercial orders with no active items |
| `zero_totals` | Commercial orders with null/zero order total |
| `invalid_product_refs` | Items referencing a non-existent product id |
| `unknown_sources` | Source labels outside the known channel list (grouped) |
| `unknown_status` | Orders with status outside the known taxonomy |
| `sync_errors` | Failed/partial/error sync runs, last 7 days |

Invalid type → 400 `INVALID_EXCEPTION_TYPE`. Auth identical to all analysis routes (Clerk admin or `X-Admin-Secret`); unauthenticated → 401.

PII note: `sales_orders` / `sales_order_items` contain no customer name/email/address columns, so drill-down rows are inherently PII-free. Only order/item metadata is returned.

## UI changes (`/super-admin/marketing/data-analyst/`)

New **Data Quality & Sync Monitor** card below Channel Analysis:
- **Exception chips** (8): count badges — green when 0 (disabled), amber for warnings, red for critical types (invalid product refs, sync errors). Clicking a non-zero chip opens the drill-down panel.
- **Drill-down panel**: description + record count, generic table of affected records, Close button.
- **Recent Sync Runs** table: last 10 runs with status badge (green success / red otherwise), record counters, error text.
- **Source Freshness by Channel** table: last order day + days-since badge (green ≤ 7d, amber ≤ 30d, grey older).
- Threshold note in the card header. DQ status was already in the main header (Phase 05 badge + banner); banner now includes the zero-total warning.

## Tests performed (local `wrangler pages dev` + local D1)

| Test | Result |
|---|---|
| `/data-quality` returns `zero_total_orders`, `thresholds`, `recent_runs` (10 rows), `channel_freshness` (4 channels) | ✅ |
| Stale sync case: last success ~24,522 min ago → status `warning`, human-readable warning | ✅ |
| Missing Product_ID case present → warning + `missing_product_id` drill-down returns the row | ✅ |
| Seeded local zero-total order (`P6-ZERO-1`, shopee, ฿0, paid) → `zero_total_orders: 1`, warning line, `zero_totals` drill-down returns exactly that row | ✅ (seed removed after test) |
| No false critical: valid-but-stale data reports `warning`, not `critical` | ✅ |
| Invalid exception type → 400 `INVALID_EXCEPTION_TYPE` | ✅ |
| Unauthenticated exceptions call → 401 | ✅ |
| Browser (agent-browser): 8 chips render, runs table 10 rows, freshness table 4 rows, banner shows all warnings, KPI badge WARNING | ✅ |
| Browser: click "Null/zero totals" chip → panel opens with 1 record, Close hides panel | ✅ |
| Sync runs table shows real failed run with `D1_EXEC_ERROR...` message (red badge) | ✅ |

Test-environment notes: local D1 binding for `wrangler d1 execute` is `DB` (not the database name). Windows wrangler sometimes crashes on exit (`Assertion failed ... uv_handle`) after `d1 execute` — command usually still applied; verify with a follow-up SELECT.

## Unresolved issues / risks

- Mapping coverage on real prod data is partial (historical mapping backlog) — chips will legitimately show amber counts in production; this is intended visibility, not a bug.
- `unknown_sources` known-channel list is duplicated between the 042 view and the exceptions SQL; if the channel taxonomy changes, update both.
- Freshness `days_since_last_order` uses `julianday('now')` (UTC); ±1-day display skew possible vs Bangkok time.

## Deploy

Not deployed. Phases 04+05+06 ship together when user triggers:
```powershell
git push origin feature/marketing-data-analyst
npx wrangler pages deploy public --project-name=mildmate-new
```

## Phase 07 readiness

Data trustworthiness is now visible without SQL (chips + banner + drill-downs). Phase 07 can build on the analysis API and dashboard as-is.
