# Phase 07 / 08 Systematic Reconciliation — 2026-09-11

Source of truth for what was actually built, verified, superseded, and still pending in the product-mapping and historical-backfill workstream. Supersedes conflicting statements in earlier Phase 07 documents.

> **Updated 2026-09-12:** Phase 07 v2, Phase 08, and Phase 17 checklists now carry per-item reconciled statuses (this pass). Repo state: all Marketing Decision System commits (Phases 03–07, through `b43c02d`) are merged into `master`; `master` additionally carries unrelated site work (SEO/canonical, mailer revisions) owned by other sessions.

## 1. Design evolution (three iterations)

| Version | Design | Status |
|---|---|---|
| v1 (2026-09-10) | Make.com scenario as the product-mapping engine, using new Worker `/api/v1/mapping/*` endpoints | ❌ Superseded — Make.com scenario never built (by decision) |
| v2 (2026-09-10/11) | Droid-built direct Notion API mapper that *resolves* unmapped records via the deterministic ladder | ❌ Superseded — resolver flow removed from the CLI (by decision 2026-09-11) |
| **v3 (2026-09-11, approved, current)** | **Confirmed-mapping sync**: Make.com remains the only system that fixes/confirms mappings in Notion. The Droid CLI syncs only `Product_Mapping_Status = "Mapped"` records into D1, gated by `D1_Current_Signature != D1_Last_Synced_Signature` (or last empty). After a successful D1 upsert it writes back only `D1_Last_Synced_Signature`. It never remaps, never touches empty/Unmapped/Review Required/Partial records. | ✅ Current design; single-record dry-run verified |

Approved business rules (v3):
- Make.com = mapping authority; Droid = sync only.
- Eligibility: `Mapped` AND (signature changed OR never synced).
- Make.com Sales Sync schedule stays OFF until Phase 08.
- Weekly automation deferred (Phase 17); mechanism decided: dedicated Cloudflare Worker + Cron Trigger (Pages cannot cron), not built yet.

## 2. Built + verified artifacts (all local-tested; NOT deployed to production)

| Artifact | Commit | Verification |
|---|---|---|
| `migrations/043_product_mapping_aliases.sql` (mapping memory + seed 1038→[20,26]) | `2301d45` | **Applied to production D1** (verified 2026-09-12: table live, seed row present — `listing_id 1038 → [20,26]`, `verified=1`) |
| `migrations/044_product_mapping_events.sql` (audit table) | `00e805a` | **Applied to production D1** (verified 2026-09-12: table live, 0 rows — no mapping events written yet) |
| Worker routes `/api/v1/mapping/catalog\|resolve\|aliases\|events` in `workers/api/sales.ts` | `2301d45`, `00e805a` | 10/10 + 4/4 local API tests passed (1038→[20,26], variation-over-listing, normalization, 400/401, idempotent upsert, events audit) |
| Runtime bundles `public/_worker.js` / `public/index.js` (633,696 bytes) | `00e805a` | Compiled + locally exercised |
| `scripts/notion-product-mapper.mjs` **v3 confirmed-mapping sync CLI** | `b43c02d` (merged to `master`) | See §3 |
| Notion read-only verification | n/a | Connection OK; data source confirmed "OrderList" (45 properties); pagination + server-side filters verified; PII fields identified and excluded from reads/logs |
| Dry-run of OrderList ID 1038 | n/a | Eligible (`Mapped`, last-synced empty); map parsed → D1 20 + 26 matching `D1_Product_IDs`; correct upsert payload built (keys `260804DW6XA3NA-1/-2`, `UNALLOCATED`, `shipped`); would update signature after success. No writes performed |

Facts confirmed against live systems:
- Prod D1: 32 active products; IDs 33/34 active; 30/31 gaps. Mapping tables `product_mapping_aliases` + `product_mapping_events` now live in prod (applied 2026-09-12 after re-auth; absent on 2026-09-11).
- "Known ID 1038" = Notion `ID` (unique_id) property, not `Order_Number` (which is `260804DW6XA3NA`).
- Live `D1_Product_Map` has two formats — current `Item N | D1 <id> | <title> | Qty <q>` (`;`-separated) and older `Line N | <src title> | MildMate -> <id> | <D1 title> | …`; CLI parses both.
- `ProductJSON` is not always JSON (ID 1038 holds plain text); CLI does not depend on it in v3.
- Make.com prod `source_item_key` convention = `{Order_Number}-{n}` (verified in prod D1); CLI matches it exactly.
- Backlog statuses are mostly EMPTY (`select equals "Unmapped"` → 0 records) — Make.com will confirm these over time; Droid ignores them.
- Notion signature fields: `D1_Current_Signature` (formula) / `D1_Last_Synced_Signature` (rich_text, currently empty on 1038).

## 3. Current CLI behavior (v3, replaces v2 handoff description)

`scripts/notion-product-mapper.mjs`: fetches only `Mapped` records (server-side filter, optional `ID` unique_id / `last_edited_time` filters), applies the signature rule, parses the CONFIRMED `D1_Product_Map` (both formats), cross-checks against `D1_Product_IDs`, validates ids against the canonical catalog, builds the sales upsert (Make-compatible item keys, exact totals, `UNALLOCATED` revenue, explicit Thai→canonical status table with no guessing), and in live mode upserts to D1 then writes back only `D1_Last_Synced_Signature`. Flags: `--dry-run`, `--limit`, `--resume` (persisted cursor), `--order-id <NotionID>`, `--edited-after`, `--input-file` (mock). Throttle 350 ms + 429/5xx backoff; JSONL logs (gitignored); no PII/token in logs.

Removed from the CLI in v3 (still available server-side for Make.com/Phase 17): resolver ladder calls, alias learning, Review-Required writes, `Product_Mapping_Status` writes.

## 4. Document status map

| Document | Status |
|---|---|
| `16_Phases/07_...Product_Mapping_Automation_Checklist.md` (v1) | ❌ Superseded (banner added) |
| `16_Phases/07_Phase/07_..._Direct_Notion_API_Product_Mapping_Checklist_v2.md` | ⚠️ Partially superseded (banner + per-item statuses added 2026-09-12): connectivity/read/inspection/dry-run items ticked as verified; resolver items marked superseded |
| `05_Mapping/Phase_07_Notion_Order_Product_Mapper_Build_Guide_2026-09-10.md` | ❌ Obsolete as a mapper design (banner added); §API endpoint reference remains valid |
| `05_Mapping/Phase_07_Historical_Mapping_Runbook_2026-09-10.md` | ✅ Rewritten for v3 confirmed-mapping sync |
| `09_Handoffs/Phase_07_Handoff_Product_Mapping_Automation_2026-09-10.md` | ⚠️ Historical record (banner added): backend endpoints/migration remain valid; Make.com mapper plan superseded |
| `09_Handoffs/Phase_07v2_Handoff_Direct_Notion_Mapper_Offline_Build_2026-09-10.md` | ⚠️ Historical record (banner added): CLI has since been reworked to v3 |
| `16_Phases/08_..._Phase_08_Historical_Sales_Backfill_Checklist.md` | ✅ Still the active Phase 08 plan; task checklist reconciled 2026-09-12 (10 items satisfied by construction by the v3 engine; live-run/reconciliation items remain open) |
| `16_Phases/17_..._Phase_17_Ongoing_Product_Mapping_Automation_Checklist.md` | ✅ **Rewritten 2026-09-12** for v3: scheduled confirmed-mapping **sync** via dedicated Cloudflare Worker + Cron Trigger; no mapping, signature write-back only |

## 5. Phase 08 implication (how backfill will actually run)

The v3 sync CLI **is** the Phase 08 backfill engine for Notion-confirmed orders:
- Historical replay does NOT use the live `From now on` watcher ✅ (CLI reads Notion directly; Make sync stays off until activation decision).
- Identity `(source_system, source_order_id)` + deterministic Make-compatible `source_item_key` ✅ built.
- Exact totals preserved; `UNALLOCATED` line revenue; no equal-splitting ✅ built.
- Controlled batches + resume + failure logging ✅ built (5 → 20 → 50 ramp planned).
- Still to do in Phase 08: define date range/scope, run live batches, reconcile counts/revenue vs Notion, coverage by period, dashboard historical-coverage view, gaps report.

## 6. Outstanding before live sync runs

1. ~~Approve + run live single-record test (ID 1038)~~ ✅ DONE (approved + executed 2026-09-12): order upserted to prod (`sales_orders` id 9; 2 items → D1 20 + 26, `UNALLOCATED`, `shipped`, `Mapped`), `D1_Last_Synced_Signature` written back to Notion, telemetry row `sync_runs` id 13 (`notion-direct-mapper` / `phase07-confirmed-mapping-sync`, success). Idempotent re-run → `skipped_unchanged: 1` with zero writes. CLI payload fields `sync_source`/`scenario` confirmed telemetry-only.
2. ~~Apply migrations 043 + 044~~ ✅ DONE — applied to production D1, verified 2026-09-12 (alias seed present; events table empty).
3. ~~Deploy the current `master` bundle~~ ✅ DONE — user-deployed 2026-09-12; verified: `/api/v1/health` OK, `/api/v1/mapping/catalog` + `/resolve` + `/sales/orders/upsert` all return proper 401 without token (routes live, auth enforced), Data Analyst dashboard returns auth redirect (not 404).
4. Decide Make.com Sales Sync activation timing (per decision: during/after Phase 08). Confirmed still OFF: last `sync_runs` entry is 2026-09-07.
5. ~~Re-verify remote D1 access~~ ✅ DONE — `wrangler login` re-authenticated 2026-09-12; read-only prod verification passed. *Note: wrangler OAuth dropped again later the same day (7403 recurred) — re-login may be needed periodically. The authenticated sales API read route `GET /api/v1/sales/orders/{source_system}/{source_order_id}` works as a wrangler-free verification fallback.*

## 7. Verification log

- 2026-09-11: Notion read-only verification + ID 1038 dry-run (details §2–§3). Prod D1 product catalog + absence of mapping tables verified read-only.
- 2026-09-12 (repo): v3 CLI flags/eligibility/signature write-back confirmed in `scripts/notion-product-mapper.mjs`; all 7 mapping routes confirmed in `workers/api/sales.ts` (`catalog` GET, `resolve` POST, `aliases` POST/GET, `events` POST/GET) plus health/upsert/read; migrations `042_marketing_analysis_layer.sql`, `043_product_mapping_aliases.sql`, `044_product_mapping_events.sql` present in `migrations/`.
- 2026-09-12 (prod, after `wrangler login` re-auth + migration apply): read-only verification passed — `product_mapping_aliases` live with 1 seed row (1038→[20,26], verified=1); `product_mapping_events` live, 0 rows; all 11 analysis views (042) present; `sales_orders` 8 / `sales_order_items` 10 / `sync_runs` 12; channels: shopee 5 (฿11,622), facebook 1 (฿7,960), tiktok 1 (฿1,290), line 1 (฿100 — smoke test `TEST-MAKE-001`); last `sync_runs` entry 2026-09-07 → Make.com Sales Sync confirmed OFF; order `260804DW6XA3NA` (Notion ID 1038) verified NOT yet in prod → live sync still pending. Note: 6 of 8 existing orders carry `mapping_status = NULL` (pre-Mapped-era Make syncs) — they can be re-upserted with status during Phase 08 or via Make.com mapping confirmation.
- 2026-09-12 (deploy): user deployed current `master` to Cloudflare Pages production; verified live — `/api/v1/health` `{"ok":true}`, `/api/v1/mapping/catalog|resolve` and `/api/v1/sales/orders/upsert` return proper 401 without Bearer token (routes + auth live), Data Analyst dashboard returns auth redirect (exists).
- 2026-09-12 (LIVE single-record sync, user-approved): ID 1038 → prod `sales_orders` id 9 created (shopee `260804DW6XA3NA`, ฿3,480 THB, `shipped`, `Mapped`, `notion_page_id` recorded); items `260804DW6XA3NA-1/-2` → D1 20 + 26, qty 1 each, `UNALLOCATED`, `active`; `D1_Last_Synced_Signature` written back to the Notion record (only field written); `sync_runs` id 13 (source `notion-direct-mapper`, scenario `phase07-confirmed-mapping-sync`, success, 1 received / 1 created / 0 rejected). Idempotency re-run → `skipped_unchanged: 1`, zero API/D1 writes; read-back via `GET /api/v1/sales/orders/shopee/260804DW6XA3NA` shows exactly 1 order + 2 items. **First production-verified live write of the v3 confirmed-mapping sync.**
- 2026-09-12 (Notion inventory, read-only): OrderList ≈999 records — `Mapped` 553 (548 signature-eligible, 5 already synced), `Review Required` 16, `Unmapped` 0, `Partial` 0, empty 430.
- 2026-09-12 (LIVE batch of 5, user-approved, ramp step 2): dry-run first — exposed a third `D1_Product_Map` format (arrow+id embedded at end of a pipe piece); parser extended + Thai `กำลังเย็บ` → `processing` added (commit `966e018`, 7/7 offline parser tests). Live run: **4 synced** → prod `sales_orders` ids 10–13 (shopee `260912RGE8GF58` ฿1,289 `pending`; shopee `260911P1D5S1BX` ฿8,569 `processing` with 3 items → D1 6/6/26; shopee `260909KATJFW9C` ฿2,544 `shipped`; website `NsaLqxvz` ฿8,190.58 exact `shipped`), all items `UNALLOCATED`, 4 signatures written back; **1 safely skipped** — record 1123, order `260908GX27N4B4`: `D1_Product_IDs` [6,26] vs map [6] mismatch, needs Notion-side fix then re-syncs automatically. Idempotency re-run: `skipped_unchanged: 4` + same mismatch, zero writes. Prod running total: 13 orders (incl. `TEST-MAKE-001` smoke test).
