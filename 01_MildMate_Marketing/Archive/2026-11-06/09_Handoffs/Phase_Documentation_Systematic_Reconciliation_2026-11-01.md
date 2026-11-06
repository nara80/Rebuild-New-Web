# Phase Documentation Systematic Reconciliation (2026-11-01)

## Scope

This reconciliation updates the Marketing Decision System documentation set to match what is actually built, deployed, and verified in production as of 2026-11-01.

This pass is documentation-only.  
No deployment, schema migration, or production runtime change was made.

## Canonical truth sources

Use these as the authoritative references first:

1. `AGENTS.md` (project memory / runtime constraints)
2. `Framework.md` (implementation and architecture baseline)
3. `01_MildMate_Marketing/09_Handoffs/Phase_01-17_Systematic_Reconciliation_2026-09-19.md`
4. `01_MildMate_Marketing/09_Handoffs/Make_com_Retirement_Systematic_Reconciliation_2026-10-01.md`
5. `01_MildMate_Marketing/09_Handoffs/Phase13_Growth_Signals_UI_Remediation_2026-10-12.md`
6. `01_MildMate_Marketing/09_Handoffs/Post_R2_Paid_Ads_And_Event_Audit_2026-10-21.md`

## Current phase status (reconciled)

| Phase | Status | Reconciled state |
|---|---|---|
| 01 | ✅ Complete | Architecture audit complete and verified. |
| 02 | ✅ Complete | Metric contract complete and in use. |
| 03 | ✅ Complete | D1 analytical layer live (base + additive migrations). |
| 04 | ✅ Complete | Read-only analysis API live and protected. |
| 05 | ✅ Complete | Data Analyst dashboard live under Super Admin auth. |
| 06 | ✅ Complete | Data quality and sync monitor live. |
| 07 | ✅ Complete (v3 path) | Confirmed-mapping sync model adopted; v1/v2 mapping designs historical only. |
| 08 | ✅ Complete | Historical backfill complete and reconciled. |
| 09 | ✅ Deployed/Operational | GSC ingestion and analysis live. |
| 10 | ✅ Deployed/Operational | GA4 ingestion live; purchase-attribution verification still open. |
| 11 | ✅ Deployed/Operational | Etsy ingestion live and reconciled. |
| 12 | 🟡 Open | Google Ads collector live, conversion-attribution closure pending. |
| 13 | ✅ Implemented | Growth/profitability foundation live; growth-signals UI remediation deployed. |
| 14 | ✅ Implemented | Opportunity model registry, scoring, and recompute workflow live. |
| 15 | ⬜ Not started | Command-center orchestration/approval UX pending. |
| 16 | ⬜ Not started | AI analyst + action feedback-loop pending. |
| 17 | ✅ Deployed/Operational | `mildmate-marketing-sync` Worker operational; Make.com retired. |

## Outdated and duplicate docs archived in this pass

Archived because superseded, duplicate-phase, or obsolete:

1. `01_MildMate_Marketing/16_Phases/07_Phase/07_MildMate_Marketing_Decision_System_Phase_07_Direct_Notion_API_Product_Mapping_Checklist_v2.md`
2. `01_MildMate_Marketing/16_Phases/07_Phase/Notion_OrderList_Developer_Connection_Build_Summary.md`
3. `01_MildMate_Marketing/16_Phases/13_MildMate_Marketing_Decision_System_Phase_13_Profitability_Layer_Checklist.md`
4. `01_MildMate_Marketing/MildMate_Notion_OrderList_to_D1_Sales_Sync_Workflow_Summary.md`

Archive target root:

`01_MildMate_Marketing/Archive/2026-11-01/`

## Active phase-checklist set after reconciliation

Active checklist directory remains:

`01_MildMate_Marketing/16_Phases/`

with one active Phase 13 checklist:

- `13_MildMate_Marketing_Decision_System_Phase_13_Sales_Growth_Layer_Checklist.md`

and no active v2 Phase 07 sub-checklist branch under `16_Phases/07_Phase/`.

## Notes

- Make.com references are historical unless explicitly called out as retired context.
- Channel-order ingestion is human-manual into Notion; automation is Worker-cron based.
- This reconciliation does not change previous evidence files. It standardizes which files are active vs archived.

---

## Reconciliation Pass 2 (2026-11-01, later) — GA4 Lead Acquisition release

A second documentation pass after the pass above, covering the GA4 Lead Acquisition controlled production release completed the same day (documentation-only; the release itself was separately approved and deployed).

### Release facts now reflected in docs

- **Migration:** `061_ga4_lead_acquisition.sql` applied to prod D1 (`854f206a-b240-491c-bb91-7e064736d487`) — `ga4_lead_acquisition_daily`, indexes, `analysis_ga4_lead_freshness` view; additive only; freshness view verified empty post-apply. Pre-migration schema snapshot: `00_Issue/ga4-lead-acquisition-20261101/prod-pre061-schema.sql`.
- **Pages:** production deployment `c023f9fd-7617-475c-8534-76742ac5e738` (rollback target `f93e5301-251e-45e6-b636-aeeb0c940411`); `public/_worker.js` rebuilt via `extract-worker.ps1`, deployed `--no-bundle`.
- **Collector:** `mildmate-marketing-sync` version `9a093445-2457-4849-9a3b-79454b260307` (prior `91421d42-3903-4a07-895b-2d663d7f3b5b`); cron `0 1 * * *` and weekday routing unchanged; no sync triggered (0 `ga4-lead-worker-cron:website` rows in `sync_runs` post-check).
- **New runtime surfaces:** `POST /api/v1/ga4/leads/upsert`, `GET /api/admin/analysis/ga4-leads`, SEO-tab "GA4 Lead Acquisition" card. Canonical property `308922589` only; events `generate_lead` + `quote_request`.
- **Smoke results:** dashboard markers (growth / sync-run grouping / GA4 lead card / 7 tabs) present; public routes 200; admin APIs 401 unauthenticated and 401 with `X-Admin-Secret` (bearer-token requirement intact).

### Docs updated in this pass

- `AGENTS.md` — Operational Reconciliation Snapshot, Phase 1 row (migrations through `061_*`), Phase 10 status, schema list, migration list, file-structure tree, D1 `--file` operational rule.
- `Framework.md` — Operational Reconciliation Snapshot, migration list, migration narrative.
- `16_Phases/10_..._Phase_10_GA4_Checklist.md` — new "Update Note (2026-11-01)" section.
- Both planning docs in `01_MildMate_Marketing/` root — reconciliation headers extended.

### Archive changes in this pass

None required. Pass 1 above already archived the superseded/duplicate files; no additional outdated or duplicated documentation was found for this scope. Session working artifacts (screenshots, validation JSON/PNGs, scratch D1) remain in `00_Issue/ga4-lead-acquisition-20261101/` as release evidence, not as active documentation.
