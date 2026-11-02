> **DOC RECONCILIATION (2026-11-01).** Authoritative phase-status matrix: `01_MildMate_Marketing/09_Handoffs/Phase_Documentation_Systematic_Reconciliation_2026-11-01.md`.

# MildMate Marketing Decision System — Phase 10
## GA4 Website Behavior & Funnel Analytics

**Project root:** `D:/00_Mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `feature/marketing-data-analyst`  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Existing Cloudflare Pages project  

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate


## Phase Goal

Add website traffic and funnel behavior to product/channel analysis.

## Prerequisites / Confirmed Baseline

- [x] GSC framework patterns established or equivalent collector conventions approved.
- [x] GA4 property/tracking verified enough for analysis.

## Task Checklist

- [x] Define GA4 dimensions and metrics required for decisions.
- [x] Define daily fact-table grain.
- [x] Collect sessions.
- [x] Collect landing-page sessions.
- [x] Collect product views where available.
- [x] Collect add-to-cart events.
- [x] Collect checkout events.
- [x] Collect purchases/conversions.
- [x] Map product page path/identity to Product_ID.
- [x] Preserve campaign/source/medium dimensions where useful.
- [x] Build authenticated ingestion endpoint.
- [x] Build GA4 collector in Cloudflare Worker (`marketing-sync-worker`) with weekly cron + manual/status endpoints.
- [x] Build GA4 analytical views.
- [x] Build funnel metrics by product/channel where defensible.
- [x] Do not double-count GA4 purchase revenue as canonical sales revenue.
- [ ] Reconcile purchase counts directionally with unified sales. *(pending first live GA4 ingest + sampled comparison)*
- [x] Add GA4 freshness monitoring.
- [x] Add Website Funnel section to Data Analyst dashboard.

## Deliverables

- [x] GA4 D1 fact table.
- [x] GA4 collector.
- [x] GA4 analysis views.
- [x] Website funnel dashboard.

## Verification / Test Checklist

- [ ] Known date totals match GA4 reports within documented definitions. *(pending first live GA4 ingest)*
- [x] Product path mapping works.
- [x] Purchase events are not added to canonical order revenue.
- [x] Missing event data is shown as unavailable rather than zero where appropriate.

## Definition of Done

- [x] Analyst can compare traffic, product interest, funnel behavior, and purchases without contaminating canonical sales facts.

## Global Guardrails

- [!] Do not expose `SALES_SYNC_API_TOKEN` or any production secret.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not modify or replace the existing operational website `orders` system unless explicitly approved.
- [!] Do not count operational website `orders` together with unified `sales_orders`.
- [!] Do not invent historical line-item revenue.
- [!] `UNALLOCATED` revenue means unknown, not zero.
- [!] Do not equal-split multi-item order totals.
- [!] Do not expose unnecessary customer PII in marketing analytics.
- [!] Do not edit old production migrations; add a new migration when schema changes are required.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not build future phases early.


## Phase Handoff Rule

- [x] Record files changed.
- [x] Record migrations/API routes/UI routes created or changed.
- [x] Record tests performed and results.
- [x] Record unresolved issues and risks.
- [x] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`. *(handoff: `09_Handoffs/Phase_10_Handoff_GA4_Analytics_2026-09-26.md`)*
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [x] Prepare a concise handoff for Phase 11 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 10 — GA4 Website Behavior & Funnel Analytics`

## Droid Working Instruction

> Work on **Phase 10 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---

## Reconciliation Note (2026-09-29)

Status update: **DEPLOYED / READY FOR LIVE RECONCILIATION**. Migration `048_ga4_analytics.sql`, token-auth GA4 ingestion API (`/api/v1/ga4/*`), read endpoint (`/api/admin/analysis/ga4`), dashboard section, and weekly collector flow (`/ga4/run`, `/ga4/status`, shared Monday `0 4 * * 1` cron) are implemented and deployed. GA4 OAuth secrets are configured. Remaining for full operational verification: run/confirm first live GA4 ingest in production and reconcile sampled GA4 totals plus directional purchase counts against unified sales.

## Reconciliation Note (2026-10-01) — PRODUCTION VERIFIED

Status update: **DEPLOYED / PRODUCTION VERIFIED**. Live reconciliation completed against the GA4 Data API and unified sales:

- Manual `/ga4/run` succeeded (sync_runs 564: 157 fetched, 26 created, 131 unchanged, 0 rejected); freshness healthy (2-day lag as configured, 0 collector errors in 7d at verification time).
- Funnel events match the GA4 Data API exactly for the 2026-09-15 → 2026-09-28 sample window: view_item 4 = D1 product_views 4; add_to_cart 2 = 2; purchase 0 = 0.
- Directional purchase check passed: 0 GA4 purchases = 0 website commercial orders in unified sales for the same window.
- **Sessions inflation defect found and fixed (2026-10-01):** the traffic report was dimensioned by `pagePath`, inflating summed sessions ~3x (471 vs 158 `session_start`). Collector now fetches session-scoped metrics without `pagePath` (landing-page attribution preserved for product mapping). `ga4_funnel_daily` was purged and rebuilt with a 90-day backfill (900 rows, 2026-07-02 → 2026-09-29); post-fix window sessions = 173 vs 158 `session_start` (residual gap is GA4's own sessions-vs-session_start definitional difference).
- Operational note: ingestion upserts cost ~2 D1 statements per row against a ~1000-subrequest ceiling; collector chunk size pinned to 400 (`GA4_UPSERT_CHUNK_SIZE`).

---

## Update Note (2026-10-28)

- Two checklist items pending "first live GA4 ingest" were satisfied by the 2026-10-01 production reconciliation and are considered closed: "Reconcile purchase counts directionally with unified sales" (0 GA4 purchases = 0 website commercial orders in window) and "Known date totals match GA4 reports within documented definitions" (funnel events matched the GA4 Data API exactly for 2026-09-15 → 2026-09-28).
- Migrations `055_ga4_multi_property.sql` + `056_ga4_property_unique_rebuild.sql` extend the GA4 layer (multi-property support; property-unique rebuild) — applied to prod.
- **2026-10-21 audits found, still OPEN:**
  - Oct 18–20 "dark window" from a consent-bridge revert — `ga4_funnel_daily` stops at 2026-10-17; 5 Ads clicks on Oct 18–19 permanently lost.
  - 6 product pages (`bedbridge-connector`, `duvet-insert`, `mattress-lift-helper`, `marine-fitted-sheet`, `marine-top-sheet`, `marine-mattress-protector`) ship zero ecommerce producers (`view_item`/`add_to_cart`) — purchase funnels structurally incomplete until the RC-1 fix.
  - Blank source/medium rows in `ga4_funnel_daily`, including one purchase on 2026-10-17 — attribution drift unproven (C1 HOLD).
  - Admin pages (`public/admin/index.html`, `public/super-admin/index.html`) still bootstrap legacy property `G-ESL161CNBV`, bypassing the consent-gated public bootstrap (contamination FAIL).
  - Overall verdict: **GA4 purchase/Ads attribution remains UNVERIFIED; broad repair on HOLD** pending owner UI checks. Remediations RG-1 (GTM quote-event trigger), RA-1 (owner UI: auto-tagging/Ads link), RC-1 (producers + `google.co.th` CSP) are planned, none executed. See `09_Handoffs/MildMate_Ads_GA4_Attribution_Verification_2026-10-21.md` and `09_Handoffs/Post_R2_Paid_Ads_And_Event_Audit_2026-10-21.md`.
- **Scheduling supersession (2026-10-08 handoff):** GA4 collection now runs on the `mildmate-marketing-sync` single daily cron (`0 1 * * *` UTC) with weekday dispatch (Mon GA4) — earlier "weekly Mon 04:00 UTC" wording is historical.

## Update Note (2026-11-01) — GA4 Lead Acquisition Deployed

Phase 10 scope extended with a lead-acquisition layer, deployed to production 2026-11-01:

- **Migration `061_ga4_lead_acquisition.sql` applied to prod D1** (additive only): `ga4_lead_acquisition_daily` (daily session-acquisition grain, `UNIQUE(report_date, property_id, event_name, session_source, session_medium, session_campaign)`), 4 indexes, and `analysis_ga4_lead_freshness` view. Freshness view confirmed in correct empty state post-apply.
- **Ingestion:** new bearer-token route `POST /api/v1/ga4/leads/upsert` (mirrored into `public/_worker.js` runtime bundle) with event-name validation (`generate_lead`, `quote_request` only) and idempotent `ON CONFLICT` upsert.
- **Collector:** `marketing-sync-worker` now runs a GA4 lead sync (`executeGa4LeadSync`) inside the Monday GA4 dispatch — canonical property `308922589` only (legacy `366290587` never merged), dimensions `date / eventName / sessionSource / sessionMedium / sessionCampaignName`, metrics `eventCount` + `totalUsers` with automatic fallback to `eventCount`-only (`users_available=false`) on metric incompatibility. Source label: `ga4-lead-worker-cron:website`. Collector version `9a093445-2457-4849-9a3b-79454b260307` (prior `91421d42`).
- **Analysis API:** `GET /api/admin/analysis/ga4-leads` (admin-authorized) — separate per-event counts/users (users render as Unavailable, never zero-fabricated), source/medium and campaign breakdowns, daily trend, freshness, historical-overlap note.
- **Dashboard:** "GA4 Lead Acquisition" card added to the SEO & Website tab at `/super-admin/marketing/data-analyst/` (Pages deployment `c023f9fd-7617-475c-8534-76742ac5e738`; rollback target `f93e5301`).
- **Guardrails respected:** cron schedule `0 1 * * *` and weekday routing unchanged; existing GA4 funnel events (`view_item`/`add_to_cart`/`begin_checkout`/`purchase`) and their metrics untouched; no manual sync or backfill triggered (post-check: 0 `ga4-lead-worker-cron:website` rows in prod `sync_runs`); admin API auth verified not weakened (401 without bearer/Clerk).
- **Verification:** 53 targeted vitest tests + 2 collector config tests passed; preview validated (`7be7b8f8` / `ga4-lead-gate-preview`) on desktop 1366px + mobile 390px with mocked representative data — 7 tabs intact, no page-level horizontal overflow, tables horizontally scrollable in wrappers. Evidence: `00_Issue/ga4-lead-acquisition-20261101/`.
- **Still pending:** first live lead rows land with the next scheduled Monday GA4 collection run; final closure requires the owner's authenticated browser acceptance test. The 2026-10-21 purchase-attribution findings above remain OPEN and are unaffected by this release.
