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
| `migrations/043_product_mapping_aliases.sql` (mapping memory + seed 1038→[20,26]) | `2301d45` | Applied to local D1 only; **not applied to preview/prod** |
| `migrations/044_product_mapping_events.sql` (audit table) | `00e805a` | Applied to local D1 only; **not applied to preview/prod** |
| Worker routes `/api/v1/mapping/catalog\|resolve\|aliases\|events` in `workers/api/sales.ts` | `2301d45`, `00e805a` | 10/10 + 4/4 local API tests passed (1038→[20,26], variation-over-listing, normalization, 400/401, idempotent upsert, events audit) |
| Runtime bundles `public/_worker.js` / `public/index.js` (633,696 bytes) | `00e805a` | Compiled + locally exercised |
| `scripts/notion-product-mapper.mjs` **v3 confirmed-mapping sync CLI** | `b43c02d` (merged to `master`) | See §3 |
| Notion read-only verification | n/a | Connection OK; data source confirmed "OrderList" (45 properties); pagination + server-side filters verified; PII fields identified and excluded from reads/logs |
| Dry-run of OrderList ID 1038 | n/a | Eligible (`Mapped`, last-synced empty); map parsed → D1 20 + 26 matching `D1_Product_IDs`; correct upsert payload built (keys `260804DW6XA3NA-1/-2`, `UNALLOCATED`, `shipped`); would update signature after success. No writes performed |

Facts confirmed against live systems:
- Prod D1: 32 active products; IDs 33/34 active; 30/31 gaps; no mapping tables in prod yet.
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

1. Approve + run live single-record test (ID 1038): D1 upsert (local/preview first, then prod after deploy) + signature write-back.
2. Apply migrations 043 + 044 to preview and production D1 (043 optional for v3 sync itself but required for `/resolve`/alias memory used by Make.com or Phase 17; 044 required if audit events are wired into the sync CLI — currently the v3 CLI logs to JSONL only).
3. Deploy the sales/mapping API bundle to production (the `/api/v1/sales/orders/upsert` endpoint is already production-verified; the newer `/api/v1/mapping/*` routes ship with the next deploy) — user-triggered.
4. Decide Make.com Sales Sync activation timing (per decision: during/after Phase 08).
5. Re-verify remote D1 access: on 2026-09-12 `wrangler d1 execute --remote` failed with Cloudflare auth error 7403 (cached credentials no longer authorized). Run `npx wrangler login` / check the account before any remote D1 operation (migration apply, live-sync verification, prod reconciliation).

## 7. Verification log

- 2026-09-11: Notion read-only verification + ID 1038 dry-run (details §2–§3). Prod D1 product catalog + absence of mapping tables verified read-only.
- 2026-09-12: Repo re-verification — v3 CLI flags/eligibility/signature write-back confirmed in `scripts/notion-product-mapper.mjs`; all 7 mapping routes confirmed in `workers/api/sales.ts` (`catalog` GET, `resolve` POST, `aliases` POST/GET, `events` POST/GET) plus health/upsert/read; migrations `042_marketing_analysis_layer.sql`, `043_product_mapping_aliases.sql`, `044_product_mapping_events.sql` present in `migrations/`. Prod D1 re-check blocked by wrangler auth error 7403 (see §6.5), so prod facts above stand as of 2026-09-11.
