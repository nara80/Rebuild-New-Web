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
- 2026-09-12 (LIVE batch of 20, user-approved, ramp step 3): dry-run surfaced 3 more live-data conventions — fixed in code (commit `345e863`, 11/11 offline tests): tolerant format A (extra pipe pieces / optional Qty), skip stray lone `| Mapped` fragments after manual edits, and ids cross-check now compares unique sets (live data mixes per-line ids `6, 6, 26` and deduped `6, 26`; genuinely missing/extra ids still fail). User also fixed record 1123's map in Notion (Line 2 → 26 BedBridge). Live run: **16 synced, 4 unchanged** → prod `sales_orders` ids 14–29 (incl. `260908GX27N4B4` [6,26]; `LuQpJi23` 5 items with quantities [21×2, 21×1, 6×2, 26×1, 25×2]; etsy `4163175341` [34×3, 34×3, 34×1]; website `9mO6H2P9` [28]); all 16 read back OK via API; 16 signatures written back; idempotency re-run `skipped_unchanged: 20`, zero writes. **Data note for review:** 3 lazada orders (`1123945742274463`, `1116581281072316`, `1125102559972316`) have no TotalAmount in Notion → synced with no order_total (participation-only; totals will fill in on re-sync if Notion is updated). Prod running total: 29 orders. Remaining eligible pool ≈ 524.
- 2026-09-12 (NEW BACKFILL RULES, user-decided): Notion totals are corrected monthly; August 2026 is still being corrected until end of September. Therefore: (1) **permanent rule** — only `Mapped` records **with a TotalAmount (> 0)** are eligible; held records re-sync automatically once the total is filled; (2) **scope rule** — the historical backfill runs **July 2026 and earlier** via the new `--before 2026-08-01` flag. Implemented in the CLI as eligibility rules 3+4 with a server-side Notion date filter (`Order_Date`/`Order_date01` OR) so `--limit` counts in-scope records only, plus client-side defense. Offline mock test 5/5 (eligible July+total, held August, held no-total, held no-date, unchanged). Verified live (dry-run): without the server filter the first 50 Mapped records were 20 September (already synced) + 30 August (held) = 0 eligible; with the server filter the same dry-run returns pure July records — 10/10 eligible, all with totals, zero skips.
- 2026-09-12 (RUN REPORT EMAIL, user-decided): every non-dry-run LIVE-Notion run emails its outcome summary to `contact@mildmate.com` — synced count, skips by reason with order numbers, errors, synced order list (shop/order/total/items), mode + scope + log file. **Dry runs never email** (previews only; conserves Resend free-tier quota — clarified 2026-09-13). Option A chosen (CLI sends via Resend now; Phase 17 cron Worker will reuse the format with only-when-changed + daily-digest cadence, since a 15-min cron is 96 runs/day vs Resend's 100/day free tier). Mock `--input-file` runs never email; a report failure never fails the sync run (logged as `email_report` in the JSONL). Implementation verified live: graceful failure path exercised when the `.dev.vars` `RESEND_API_KEY` turned out to be a placeholder (Resend 401) — run completed, warned, logged; resolved with user creating a fresh Resend key and removing the placeholder duplicate. **Pending: user to put the real Resend key in `.dev.vars`, then re-test the email send before the batch of 50.**
- 2026-09-12 (Resend key + email verified): user created a fresh Resend API key (old value was a placeholder → 401; duplicate placeholder line removed from `.dev.vars`, real key kept, never printed). Key validated against Resend (`mildmate.com` verified domain). Verification dry-run emailed the first report successfully (Resend id `3d803c63…`). Every run since emails `contact@mildmate.com`.
- 2026-09-12 (LIVE batch of 50, user-approved, ramp step 4, first run under the new scope rules `--before 2026-08-01` + TotalAmount-required): dry-run 49 eligible + 1 held. Live run: **49 synced** → prod `sales_orders` ids 30–78 (July 2026 records: July 25–31 in the first page, e.g. `2607315XJWVCHY` ฿3,390 shipped [6×1]; `260731560BJ6JV` ฿1,790 [4×1]; `260729V0RBQK01` ฿189 [25×1]); **49/49 read back OK via API, all with totals** (no-total rule confirmed: zero missing totals); 49 signatures written; 0 errors; report emails sent for dry-run, live, and idempotency runs. Idempotency re-run: `skipped_unchanged: 49` + 1 mismatch, zero writes. **Held record 1020** (etsy `4125508489`, ฿4,897, qty 2): marked Mapped but `D1_Product_Map` still contains a placeholder — `Item 1 | D1 0 | | Qty 2 | Status Review Required` — while `D1_Product_IDs` says **3 (Marine Fitted Sheet)**; fails safely as `skipped_ids_mismatch`, syncs once the map is corrected in Notion. Prod running total: **78 orders**.
- 2026-09-13 (Record 1020 fixed by user): user corrected `D1_Product_Map` for record 1020 in Notion to point to D1 3 (Marine Fitted Sheet). Verified: dry-run → `dry_run_eligible: 1` with payload items `[3×2]`, total ฿4,897, signature changed. Live → `synced: 1` → prod `sales_orders` id 79 (etsy `4125508489`, ฿4,897 `shipped`, items `[3×2]`) read back OK via API. Idempotency re-run → `skipped_unchanged: 1`, zero writes. Three report emails sent (dry-run, live, idempotency). Prod running total: **79 orders**; held list from the batch of 50 now clear.
- 2026-09-13 (DRY-RUN NO-EMAIL, user-decided): per user request, dry-runs now never email Resend — they are previews, not real outcomes, so the policy conserves the Resend free-tier quota. Verified live: dry-run of 1020 prints `Report email skipped (dry-run does not consume Resend quota)` and writes `email_report: status=skipped_dry_run` to the JSONL. Real runs (non-dry-run, non-mock) continue to email `contact@mildmate.com`. Commits `ec91705` + `6f6443f`.
- 2026-09-13 (FULL JULY-AND-EARLIER BACKFILL, user-approved, ramp step 5): `--resume --before 2026-08-01` against a clean cursor (state file deleted). Live run: **404 synced**, 54 unchanged, **18 held** (5 no-total + 6 ids-mismatch + 7 parse-failed), 0 errors, 476 processed; 1 report email sent. Idempotency re-run: **458 unchanged + same 18 held, zero writes**, 1 report email sent. Prod read-back: 403/403 unique synced orders verified OK via the sales API; zero missing totals (TotalAmount rule confirmed across the whole backlog). Prod running total: **483 orders** (was 79 before this run).
  - **Held records needing Notion-side fixes** (will re-sync automatically once corrected — signature changes):
    - `no TotalAmount` (5): IDs 951 / 4091532487; 793 / 1083209641342494; 792 / 1083191898942494; 775 / —; 704 / 3967841351
    - `ids mismatch` (6): 932 / 80718738Li `[2,6]→[2,16]`; 892 / 4058881811 `[3]→[0]`; 868 / 77607156Li `[6]→[0,6]`; 799 / 4012450987 `[6]→[0]`; 794 / 74156363Li `[1]→[4,0]`; 787 / 73646724Li `[1]→[0]`
    - `map parse failed` (7): IDs 810 / —; 742 / 260221AYTEQT99; 707 / 70179753Li; 631 / 37954119Li; 629 / 37961486Li; 611 / 38662066Li; 609 / 38732335Li — all reason `Unrecognized D1_Product_Map segment: "Review Required | No Parsed Item"` (their maps still contain the literal "Review Required" string and have no parsed line)
  - All held records have `Product_Mapping_Status = Mapped` in Notion — these are the records Make.com has confirmed as Mapped but where the operator (or Make.com scenario) never wrote a usable map. Manual fix in Notion required.
- 2026-09-13/14 (HELD-RECORD CLEARANCE — all 18 resolved, user-driven): the held list from the full backfill is now empty. Resolution split:
  - **Deleted in Notion** (canceled / duplicate records the operator chose to remove): 775 (first copy), 792, 793, 794.
  - **`Product_Mapping_Status` flipped off `Mapped`** (Droid-applied at user instruction, via a temporary `tmp-flip-status.mjs`; property type is `select`): 611, 629, 631, 707, 742, 810 — the seven group-C records whose maps were the literal `"Review Required | No Parsed Item"`. Flipping the status returns them to Make.com's queue, so the scheduled sync's server-side `Mapped` filter excludes them permanently. The original Notion rows are retained as audit history. **No D1 removal was required — none of the 18 held records was ever written to D1**, so there was nothing to roll back.
  - **Corrected in Notion by the user, then synced** (3): 609 / `38732335Li` (฿7,523, 2025-02-05, `[1×1]`); 630 / `37954914Li` (฿7,150, 2025-01-27, `[1×1, 1×1, 16×2, 16×2]` — the fix was a one-character typo, `tem 4` → `Item 4`, which the parser correctly refused to guess at); 775 / `38386573Li` (฿2,900, 2023-07-19, `[1×1]` — re-created by the operator, then completed in two rounds: `TotalAmount` first, `Order_Number` second).
  - Each of the three was verified the same way: dry-run → eligible; live → `synced: 1`; API read-back; idempotency re-run → `skipped_unchanged`, zero writes.
  - Operational note worth carrying forward: several user edits did not persist on the first attempt (verified via `last_edited_time` not advancing). Always confirm a Notion edit landed by re-reading the record before concluding a fix failed.

## 8. Phase 08 closure — reconciliation report (measured 2026-09-18, production D1, read-only)

Authoritative figures from production `sales_orders` / `sales_order_items`:

| Metric | Value |
|---|---|
| Orders | **493** |
| Order items | **737** |
| Date span | 2023-07-19 → 2026-09-11 |
| Total order revenue | **฿1,552,277.63** |
| Orders with ≥1 item | 493 / 493 (no orphan headers) |
| Items with a resolved `product_id` | 737 / 737 (zero unmapped) |
| Lines with `revenue_status = UNALLOCATED` | 737 / 737 (100% — correct by design) |

Coverage by channel:

| Channel | Orders | Revenue (THB) |
|---|---|---|
| shopee | 353 | 895,020 |
| line | 55 | 338,511.80 |
| etsy | 34 | 156,388 |
| lazada | 33 | 80,079.83 |
| tiktok | 11 | 22,410 |
| website | 4 | 42,657.99 |
| facebook | 2 | 12,630 |
| whatsapp | 1 | 4,580 |

Coverage by year (sufficient for 28-day / 90-day trend and participation analysis):

| Year | Orders | Revenue (THB) |
|---|---|---|
| 2023 | 1 | 2,900 |
| 2024 | 2 | 10,250 |
| 2025 | 137 | 395,376.73 |
| 2026 | 353 | 1,143,750.90 |

### Known gaps / exceptions (carry into reporting)

1. **Prices recorded as quantities on two Line orders** — newly found during this reconciliation, still open:
   - `44423079Li` (2025-04-12, total ฿10,980): 3 lines of product 16 with quantities **5000, 3780, 2200**, summing to **exactly the order total**. The `Qty` position in Notion holds line prices, not counts.
   - `38507565Li` (2025-02-02, total ฿5,000): 4 lines with quantities summing to 4,760 — same pattern.
   - Effect: **unit counts are inflated** (16,682 recorded units vs ~940 plausible). **Revenue is unaffected** — order totals are exact and line revenue is `UNALLOCATED`, so the corruption cannot leak into money metrics.
   - Guardrail until fixed: treat `SUM(quantity)` as unreliable; prefer order counts and revenue. Fix by correcting `Qty` in the two Notion maps, after which both re-sync automatically (signature changes).
   - `71333567Li` (2026-02-17, ฿33,660, qty 36) also exceeds the >20 threshold but is plausible as a genuine bulk order (≈฿935/unit) — left as-is, flagged for operator confirmation.
2. **Smoke-test order `TEST-MAKE-001`** must stay excluded from business KPIs (pre-existing guardrail).
3. **Pre-Mapped-era Make.com rows** — 6 of the original 8 orders carry `mapping_status = NULL`; they predate the Mapped convention and can be re-upserted if that field becomes reportable.
4. **August 2026 and newer are intentionally absent.** The backfill scope was `--before 2026-08-01` because Notion totals are corrected a month in arrears. The scheduled sync (Phase 17) now derives this cutoff automatically.

### Acceptance checks

- Duplicate re-run returns `skipped_unchanged` rather than duplicating: verified twice (458 unchanged, then 25/10 unchanged post-refactor), zero writes.
- Multi-item historical orders remain a single order header: verified (493 orders / 737 items, `orders_with_items` = 493).
- `UNALLOCATED` logic preserved: 737/737.
- Failed records recoverable: all 18 held records were recovered or explicitly retired without data loss.

## 9. Phase 17 — scheduled sync build (2026-09-18)

See `Phase_17_Handoff_Scheduled_Confirmed_Mapping_Sync_2026-09-18.md` for the full record.
