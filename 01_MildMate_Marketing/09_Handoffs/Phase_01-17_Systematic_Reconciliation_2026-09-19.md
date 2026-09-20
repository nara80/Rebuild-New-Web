# MildMate Marketing Decision System — Systematic Phase Reconciliation (2026-09-19)

Evidence-based reconciliation of all 17 phase checklists in `16_Phases/` against the repository, production D1 (`mildmate-db-prod`), and live endpoints. Performed after the Phase 17 Worker deploy on 2026-09-19.

## 1. Why this was needed

Phases 01–07 were genuinely built and documented (a handoff exists in `09_Handoffs/` for every one of them), but their checklists were never updated after the work landed — they showed 3–10% complete while the systems were live in production. Phases 08 and 17 were maintained; phases 09–16 were accurate (not started). Every checklist now carries a dated **Reconciliation Note** with its evidence.

## 2. Verified status per phase

| Phase | Status | Key evidence (verified 2026-09-19) |
|---|---|---|
| 01 Architecture Audit | ✅ Complete | Audit report `Phase_01_Architecture_Audit_Report_2026-09-07.md`; branch `feature/marketing-data-analyst` exists local + origin |
| 02 Metric Contract | ✅ Complete | `02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md` (321 lines); automated check confirmed all 25 required concepts defined |
| 03 D1 Analytical Layer | ✅ Complete, in production | Migration 042 defines **10 views** (earlier docs wrongly said 11 — corrected); all 10 confirmed live via `sqlite_master` |
| 04 Analysis Read API | ✅ Complete, in production | `workers/api/admin-analysis.ts` (658 lines, 6 routes); live probes all return 401 unauthenticated (exist, auth enforced) |
| 05 Data Analyst Dashboard | ✅ Complete, in production | `public/super-admin/marketing/data-analyst/index.html` (507 lines); live URL returns 302 auth redirect; 7 filters, KPI cards, 3 tables, nav entry |
| 06 Data Quality & Sync Monitor | ✅ Complete, in production | `analysis_data_quality` view + `/data-quality` route live; Data Quality & Source Freshness sections in dashboard; sales-sync banner in Super Admin (`d8504d7`) |
| 07 Product Mapping Automation | ✅ Complete (as v2 pivot) | v1 Make.com auto-mapper **superseded** by direct Notion mapper (never maps/guesses; syncs human-confirmed `Mapped` only); 490 prod `notion-direct-mapper` runs; 27/27 parser regression suite; 16 v1-design items left unchecked with *(superseded)* annotation |
| 08 Historical Backfill | ✅ Complete (1 UI item open) | 493 orders / 737 items / ฿1,552,277.63 in prod; all 18 held records resolved; open: dashboard historical-coverage UI |
| 09 GSC collector | ⬜ Not started | No artifacts in repo or prod D1 |
| 10 GA4 collector | ⬜ Not started | No artifacts |
| 11 Etsy performance | ⬜ Not started | No artifacts |
| 12 Paid media | ⬜ Not started | No artifacts |
| 13 Profitability layer | ⬜ Not started | No artifacts |
| 14 Opportunity engine | ⬜ Not started | No artifacts |
| 15 Command center | ⬜ Not started | No artifacts |
| 16 AI analyst | ⬜ Not started | No artifacts |
| 17 Scheduled mapping sync | ✅ Deployed + operational (go-live 2026-09-19) | See §3 |

## 3. Phase 17 deployment state — RESOLVED same day

**Go-live completed 2026-09-19 (after the findings below):** migration 045 applied to prod (tables + seed rows verified); worker URL `https://mildmate-marketing-sync.nara19080.workers.dev`; controlled test passed (`/status` OK; dry-run 5 → 5/5 `skipped_unchanged`; prod `sync_runs` id 503 success; lock released, state saved). Remaining to observe: first live scheduled cycle syncing a newly confirmed `Mapped` record.

### Original findings (pre-fix)

- Worker `mildmate-marketing-sync` deployed 2026-09-19T00:24Z (version `957956a5`); all 4 secrets set (`NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, `SALES_SYNC_API_TOKEN`, `RESEND_API_KEY`).
- **`migrations/045_marketing_sync_state.sql` was never applied to production.** `marketing_sync_state` and `marketing_sync_lock` do not exist in `mildmate-db-prod`, so every scheduled/drain invocation fails at `loadState()`. Failure mode is safe (caught error, zero writes), but the Worker does nothing.
- Confirmed: **zero `notion-mapping-sync` rows** in prod `sync_runs`. Sources present: `notion-direct-mapper` ×490 (latest 2026-09-14), `notion-orderlist` ×12 (latest 2026-09-07 — Make.com Sales Sync remains OFF, as decided).
- **Go-live steps:** (1) apply migration 045 remotely; (2) `POST /run?dry=1&limit=5` with bearer token; (3) confirm `notion-mapping-sync` row in `sync_runs`; (4) let the schedule run (main: 1st/15th 02:00 UTC; drain: hourly).

## 4. Corrections applied during this reconciliation

- "11 analysis views" → **10** (migration 042 count), fixed in the Phase 08 checklist and `Phase_07_08_Reconciliation_2026-09-11.md`.
- `product_mapping_aliases` clarified: contains the seeded verified `1038 → [20, 26]` row (migration 043) but no automation consumes it yet.
- Phase 08 handoff item satisfied by `Phase_07_08_Reconciliation` §8/§9 (next phase chosen was 17, not 09) — noted inline.
- Phase 17 "enable cron only after controlled test passes" flagged as a **compliance gap**: crons went live with the deploy before the production test ran.

## 5. Known open issues (carried forward)

1. ~~Migration 045 not applied to prod~~ — **resolved 2026-09-19**: applied via `d1 execute --remote --command` (file-import endpoint is auth-blocked on this account); both tables + seed rows verified.
2. ~~Controlled production test not run~~ — **resolved 2026-09-19**: `POST /run?dry=1&limit=5` passed, `sync_runs` id 503 (see §3).
3. ~~Phase 08 open UI item: historical-coverage view in the Data Analyst dashboard~~ — **resolved 2026-09-20**: "Historical Coverage" card built (coverage block on the data-quality API; per-year "thin"/"partial" flags; per-channel first/last order dates). Pending one production deploy by the operator.
4. Data quality: prices recorded as quantities on Line orders `44423079Li` (qty 5000/3780/2200) and `38507565Li`; `71333567Li` (qty 36) needs operator confirmation — corrections belong in Notion.
5. 429 backoff path never fault-injected; `cron-worker/` (legacy) still points at preview D1.
6. `product_mapping_events` audit table live but unused until the Worker runs.

## 6. Final pipeline architecture (user decision, 2026-09-19)

Make.com is **not** used for Notion→D1 sync — the Worker reads Notion directly.

```
Sales channels (Shopee/Line/TikTok/FB/Etsy...)
    │  ① Make.com — channel→Notion order ingestion (ongoing + backfill; must stay active)
    ▼
Notion OrderList ←— ② Human confirms mapping (Product_Mapping_Status = Mapped; never guessed)
    │  ③ Worker mildmate-marketing-sync — direct Notion API → D1 (scheduled)
    ▼
D1 sales_orders / sales_order_items
```

- The Make.com scenario `MildMate - Notion OrderList to D1 Sales Sync` is **permanently retired** (stays OFF; safe to archive/delete in Make.com).
- Make.com's remaining role is exclusively **channel→Notion** ingestion — the Worker never creates OrderList records, so those import scenarios must remain active or the Worker will find nothing new to sync.
