# Make.com Retirement — Systematic Reconciliation (2026-10-01)

**Owner decision (2026-10-01):** MildMate no longer uses Make.com workflow automation at all. Every pipeline in the Marketing Decision System now runs on Cloudflare Worker crons (`mildmate-marketing-sync`) plus human data entry in Notion. This document reconciles all Make.com-era documentation against what is actually built, deployed, and production-verified.

---

## 1. Current production architecture (verified against prod `sync_runs`, 2026-10-01)

```
Sales channels (Shopee/Line/Lazada/TikTok/FB/Etsy/Website...)
    │  ① Human enters/imports orders into Notion OrderList (manual — Make.com import scenarios retired)
    ▼
Notion OrderList ←— ② Human confirms mapping (Product_Mapping_Status = Mapped; system never guesses)
    │  ③ Worker mildmate-marketing-sync — direct Notion API → D1
    │     cron "0 2 1,15 * *" main pass + "0 * * * *" hourly drain
    ▼
D1 sales_orders / sales_order_items  →  analysis views  →  Data Analyst dashboard

External collectors (no Notion, no Make.com — direct source APIs → D1):
    GSC         cron "0 3 * * 1"   (gsc-worker-cron)
    GA4         cron "0 4 * * 1"   (ga4-worker-cron)
    Etsy        cron "0 4 * * 1"   (etsy-worker-cron, rotating encrypted OAuth)
    Google Ads  cron "0 4 * * 1"   (google-ads-worker-cron; awaiting first campaigns)
```

### Production evidence (`sync_runs` grouped by source, queried 2026-10-01)

| Source | Runs | Last run | Status |
|---|---|---|---|
| `ga4-worker-cron` | 13 | 2026-10-01 | ✅ active (Worker cron) |
| `etsy-worker-cron` | 1 | 2026-10-01 | ✅ active (Worker cron) |
| `notion-mapping-sync` | 27+ | 2026-10-01 | ✅ active (Worker cron, Phase 17) |
| `gsc-worker-cron` | 52 | 2026-09-27 | ✅ active (Worker cron, weekly) |
| `notion-direct-mapper` | 490 | 2026-09-14 | 🟡 CLI tool (manual/local runs only) |
| `notion-orderlist` | 12 | 2026-09-07 | ❌ dead — Make.com-era source, permanently retired |

No Make.com-originated ingestion has written to prod since 2026-09-07. All active ingestion is Worker-cron or ad-hoc Worker/CLI.

---

## 2. What changed vs the 2026-09-19 architecture decision

The 2026-09-19 reconciliation kept one Make.com responsibility: **channel→Notion order imports** ("must stay active"). That responsibility is now also retired:

- **Channel→Notion ingestion is human-manual.** Team members enter/import channel orders into Notion OrderList by hand. No automation creates OrderList records.
- Everything else from 2026-09-19 stands: humans confirm mappings in Notion; the Worker syncs only `Product_Mapping_Status = Mapped` records into D1; the Make.com sales-sync scenario stays permanently retired.

**Operational consequence (known gap):** unified-sales freshness now depends on manual entry cadence. At reconciliation time, the latest order in `sales_orders` is 2026-09-11 (549 orders total; Shopee latest 2026-09-11, Etsy 2026-09-03, Line 2026-08-31). This lag is upstream of the Worker — the Worker drains whatever is Mapped in Notion. Note also the Worker's `SYNC_BEFORE_MODE = "rolling-prev-month"` cutoff: orders of the current and previous month are intentionally held until they settle.

---

## 3. Phase 17 Worker — subrequest-limit fix (2026-10-01, deployed + verified)

The 2026-10-01 02:00 UTC main pass (sync_runs id 565) died with *"Too many subrequests by single Worker invocation"* after syncing 5 orders, leaving state `failed` (which the hourly drain does not resume).

**Fix (deployed, Worker version `55b0584d`):**
- `scripts/notion-mapper-core.mjs` now counts outbound HTTP calls (`throttledNotionFetch` + `workerFetch`) and `runSync` accepts `maxSubrequests`; the run bounded-stops with cursor carry-over (same path as the time budget) instead of crashing. Mid-page stops keep the cursor at the current page start; already-synced records skip by signature on resume.
- Worker passes `SYNC_MAX_SUBREQUESTS` (default/pinned `"20"` in `wrangler.toml`), leaving headroom for its own D1 state/lock/cursor writes under the per-invocation cap.
- Hard failures no longer overwrite the mid-run cursor with the stale pre-run value (`lastSavedCursor` preserved in the catch path).
- Manual override: `POST /run?max-subrequests=N`.

**Verification (production, 2026-10-01):** five consecutive `POST /run` passes: partial (10 synced) → partial (10) → partial (9) → partial (6) → **success/exhausted** (133 scanned, 0 errors). 35 backlogged orders drained; `sales_orders` 515 → 549; final state `success`, cursor reset, `consecutive_failures 0`.

---

## 4. Documentation status after this reconciliation

| Document | Status |
|---|---|
| `09_Handoffs/Phase_01-17_Systematic_Reconciliation_2026-09-19.md` | §6 architecture **superseded** on the Make.com channel→Notion point (banner added) — rest stands |
| `MildMate_Notion_OrderList_to_D1_Sales_Sync_Workflow_Summary.md` | **Obsolete** (Make.com scenario doc; scenario permanently retired, superseded by Phase 17 Worker) — banner added |
| `05_Mapping/Phase_07_Historical_Mapping_Runbook_2026-09-10.md` | Make.com references outdated: mapping confirmation is human-in-Notion; order import is human-manual — banner added |
| `MildMate_Data_Analyst_Dashboard_Phased_Implementation_Checklist_Droid_Guide_v2_2026-09-07.md` | Historical plan; "Automation = Make.com" layer replaced by Cloudflare Worker crons — banner added |
| `MildMate_Marketing_Decision_System_Data_Analysis_Plan_2026-09-07.md` | Historical plan; same replacement — banner added |
| Phase 01/02/06/07 checklists + older handoffs mentioning Make.com | Historical records of what was true at the time — left unchanged |
| `AGENTS.md` | Marketing snapshot updated with the 2026-10-01 retirement |

## 5. Build/verification state summary (2026-10-01)

- ✅ Production-verified: unified sales tables/API; Phase 17 Worker Notion→D1 (incl. subrequest fix + drain); GSC collector (52 runs); GA4 analytics (sessions-dedupe fix + 90-day rebuild); Etsy analytics (rotating OAuth, first live ingest reconciled)
- 🟡 Deployed, awaiting data: Google Ads collector (no campaigns yet)
- ❌ Retired, never to rebuild unless re-approved: all Make.com scenarios (sales sync, channel imports, planned auto-mapper); Meta Ads integration (owner decision 2026-09-29)
- ⬜ Known gap (owner-accepted): manual channel→Notion order entry cadence governs unified-sales freshness
