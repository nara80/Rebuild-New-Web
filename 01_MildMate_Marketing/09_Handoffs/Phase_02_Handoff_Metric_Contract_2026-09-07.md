# Phase 02 Handoff — Metric Contract & Analytical Data Design

**Date:** 2026-09-07 · **Branch:** `feature/marketing-data-analyst` · **Status:** ✅ Complete, ready for review

## Deliverable

`01_MildMate_Marketing/02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md` — the authoritative metric contract (M1–M30) with SQL design for the Phase 03 analytical views.

## Key decisions locked in

1. **Commercial statuses:** `paid, processing, shipped, completed` (owner-approved). `pending, cancelled, refunded, archived` excluded; `TEST-%` source_order_ids excluded.
2. **Mapping derived from items**, not `sales_orders.mapping_status` (verified NULL on 7/8 prod rows while 100% of items have `product_id`).
3. **Channel = normalized `source_system`** (`channel` column is unreliable/NULL).
4. **Analytics day = `substr(order_date,1,10)`** (handles both verified formats: date-only and ISO UTC); Bangkok-day drift documented, revisit at Phase 08.
5. **Revenue guardrails:** order revenue from `order_total`; product revenue from EXACT `line_revenue` only; UNALLOCATED = NULL, rendered as "no data", never ฿0.
6. **Phase 03 = SQL views** (not tables), migration `042_marketing_analysis_layer.sql`, all objects prefixed `analysis_`.

## Verified production baseline (2026-09-07)

7 commercial orders / ฿20,872 / 13 units / AOV ฿2,981.71 · channels: shopee 5, tiktok 1, facebook 1 · mapping 100% · EXACT coverage 0% (all UNALLOCATED) · last sync 2026-09-07T09:12Z, 0 errors. Full expected-results table in contract §9 — Phase 03 must reproduce it.

## Tests performed

Read-only SELECTs on `mildmate-db-prod` (status/channel/mapping/revenue-status distributions, full order+item listing, sync_runs, date formats). No writes, no code changes.

## Unresolved / carried risks

- Timezone bucketing (UTC vs Bangkok day) — accepted, revisit Phase 08.
- Runtime bundle parity (`public/_worker.js` / `public/index.js`) — must verify at Phase 04 before adding API endpoints.
- Make.com scenario leaves order-level `mapping_status` NULL — contract works around it; optional scenario fix later.

## Phase 03 instructions

Implement §8 views exactly, in a new migration `042_marketing_analysis_layer.sql` (CREATE VIEW IF NOT EXISTS only). Apply to preview DB (`mildmate-db`) first, validate §9 expected results, then apply to prod only after explicit approval.
