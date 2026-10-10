# MildMate Marketing Decision System — Phase 13
## Validation and Reconciliation Report

Date: 2026-10-09  
Mode: Read-only validation + local tests (no deploy, no writes)

## 1) Scope

Validated existing Phase 13 implementation against checklist and frozen `growth_signal_contract: "v1"` semantics.

Out of scope:
- Phase 12 collector changes
- Phase 14 score/weight/ranking logic changes
- D1 schema migrations

## 2) Repository Safety / Isolation

- Primary workspace (`master`) is dirty and unchanged.
- Isolated worktree created:  
  `D:\00_mildmate\re-build_web_phase13_closeout` on branch `phase13-closeout`.
- Primary workspace status preserved; Phase 13 closeout artifacts/tests were created only in isolated worktree.

## 3) Local Automated Contract Regression

Test file added:
- `workers/api/tests/phase13-growth-signals.contract.test.mjs`

Test run:
- Bundled `workers/api/admin-analysis.ts` with esbuild to temp module
- Executed `node --test workers/api/tests/phase13-growth-signals.contract.test.mjs`

Results:
- Tests: **14**
- Pass: **14**
- Fail: **0**

Validated scenarios:
1. v1 contract includes all 8 signal envelopes and Ads neutral policy.
2. stale freshness status behavior.
3. mapping-gap behavior.
4. missing-source behavior returns insufficient signal semantics.
5. auth enforcement (unauthenticated request rejected).
6. explicit Ads zero-row neutrality regression: sparse Ads remains neutral, contract stays v1, demand is not misrepresented as proven zero, and confidence/reward-penalty behavior is unchanged versus equivalent non-sparse Ads.
7. complete source coverage + genuine zero sales preserves valid `-100%` momentum interpretation.
8. coverage ending before current window returns `stale_source` and `units_growth_pct = null`.
9. missing coverage watermark metadata returns `insufficient_signal` and `units_growth_pct = null`.
10. partial current-window coverage returns `stale_source` and `units_growth_pct = null`.
11. null mapped-order denominator remains null (no synthetic fallback).
12. UI script includes explicit momentum coverage badge + null-safe rendering.

## 4) Production Read-Only Validation

### 4.1 Auth behavior (endpoint surface)
- Unauthenticated production request to growth-signals endpoint returns unauthorized (401 behavior confirmed on endpoint surface).

### 4.2 Authenticated production growth-signals call
- **Owner-side verification completed** (authorized browser session evidence provided):
  - HTTP `200`
  - `success = true`
  - `growth_signal_contract = "v1"`
  - all 8 signal envelopes present
  - Google Ads `insufficient_or_sparse` + `neutral_in_phase13`
  - confidence reported as `72`

### 4.2.1 Owner-side production reconciliation checklist (authorized browser session)
Use this exact checklist in Super Admin session:
1. `GET /api/admin/analysis/growth-signals` returns HTTP `200`.
2. `growth_signal_contract === "v1"`.
3. All 8 signal envelopes exist:
   - demand
   - momentum
   - conversion_availability
   - channel_context
   - source_freshness
   - mapping_coverage
   - confidence
   - profitability_guardrail
4. Each envelope contains `value/status/coverage/freshness_days/confidence_impact/reason`.
5. Google Ads policy shows sparse state as neutral when Ads rows are absent:
   - `business_signal: insufficient_or_sparse`
   - `scoring_effect: neutral_in_phase13`
6. UI “Sales Growth Signals (Phase 13)” values and statuses match API payload.
7. No UI/API text implies “proven zero demand” from missing Ads rows.
8. Profitability remains guardrail context, not ranking output in this section.

### 4.3 Source-view reconciliation (direct production D1 reads)
Anchor window used for 28d checks: `2026-09-11` to `2026-10-08`; previous `2026-08-14` to `2026-09-10`.

Observed aggregates:
- GA4 website sessions current: `270`; mapped: `228`; previous: `398`
- GSC clicks current: `6`; mapped: `1`; previous: `13`
- Etsy views current: `15022`; mapped: `12147`; previous: `0`
- Google Ads rows current: `0`; cost: `0`; conversions: `0`; mapped cost: `0`
- Sales current window: orders `0`, units `0`; previous: orders `44`, units `79`

Freshness view snapshot:
- GA4 latest `2026-10-03`, days `6`
- GSC latest `2026-10-04`, days `5`
- Etsy latest `2026-10-03`, days `6`
- Google Ads latest `null`, rows `0`

Profitability coverage snapshot (`analysis_profit_coverage`):
- Active products `32`
- Products with cost `32` (verified `3`)
- Full-cost orders `536` / commercial orders `536`

### 4.4 Sales-source coverage evidence (production read-only)

Observed source state:
- Sales ingestion source: `notion-mapping-sync` (`marketing-sync-worker`).
- Last successful sales sync state (`marketing_sync_state.last_success_at`): `2026-10-01T15:08:36.778Z`.
- Latest sales-sync run (`sync_runs` source `notion-mapping-sync`): `id 635`, status `success`.
- Latest observed source order date in `sales_orders`: `2026-09-11`.
- No production object currently stores an explicit trusted sales coverage watermark (for example, no `coverage_through_day` persisted by sync).

Implication:
- `MAX(order_day)` is an observation of loaded business events, not a guaranteed ingestion-coverage watermark.
- Without an explicit watermark, current-window zero can be real or coverage-limited; it must be treated as unverified for momentum direction.

### 4.5 Freshness semantics distinction (documented, unchanged thresholds)

Operational data-quality warning thresholds (Data Analyst health monitoring):
- GA4 warning when `days_since_latest_report > 3`
- GSC warning when `days_since_latest_report > 4`

Growth-signal tolerance thresholds (Phase 13 analytical usability):
- GA4 stale when `days_since_latest_report > 10`
- GSC stale when `days_since_latest_report > 14`

Interpretation:
- Operational warnings are intentionally stricter and can coexist with analytically usable signals.
- This is expected behavior, not a contradiction.
- No threshold values were changed in this correction.

## 5) UI vs API Contract Parity (Code-Level Verification)

Verified in Data Analyst UI:
- `public/super-admin/marketing/data-analyst/index.html`
- “Sales Growth Signals (Phase 13)” section exists.
- Calls `/api/admin/analysis/growth-signals`.
- Renders:
  - Value
  - Status
  - Coverage
  - Freshness days
  - Confidence impact
  - Reason
- Displays Google Ads as neutral/sparse through `google_ads_policy`.
- Profitability rendered as secondary guardrail signal and separate profitability block.

## 6) Google Ads Neutrality Validation

Confirmed in API implementation:
- `google_ads_policy.business_signal` resolves to `insufficient_or_sparse` when Ads data is sparse/zero.
- `google_ads_policy.scoring_effect` is `neutral_in_phase13`.
- Ads absence does not force synthetic positive/negative growth score behavior.

## 7) Phase 14 Boundary Regression

Inspected, unchanged:
- `scripts/opportunity-core.mjs`
- `workers/api/admin-opportunity.ts`
- `marketing-sync-worker/index.js` Friday opportunity recompute path

No modifications to:
- score formulas
- score weights
- ranking/recommendation logic
- opportunity recompute scheduling

## 8) Known Limitations

1. A trustworthy persisted sales coverage watermark is not yet available in production metadata.
2. Phase 12 remains open; Google Ads non-zero ingestion validation is still pending separate approved run window.
3. Current source windows can legitimately produce low/zero sales momentum and sparse GSC signal depending on anchor date and data lag.

## 9) Explicit Phase 13 closure criteria

Phase 13 can move from **CONDITIONAL CLOSE** to **CLOSE** when all are true:
1. Owner-authenticated production payload evidence remains archived (completed).
2. Momentum coverage guard local correction is validated and approved for deployment.
3. No Phase 14 scoring/ranking/recompute regressions are introduced.
4. Phase 12 may remain open; Ads sparse state must continue to be represented as neutral metadata (not forced zero demand).

## 10) Conclusion

Phase 13 implementation is present and contract semantics are stable.  
Owner-authenticated production contract evidence is now complete.  
This report adds a local-only momentum coverage guard correction to prevent unverified `-100%` momentum interpretation when sales coverage watermark metadata is missing or stale.
