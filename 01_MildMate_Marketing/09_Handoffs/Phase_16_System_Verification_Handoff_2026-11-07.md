# Phase 16 — System Verification & Preview Remediation Handoff (2026-11-07)

Consolidated verification and correction of the **existing** Phase 16 preview implementation
(Marketing Command Center + AI Analyst + human approval loop). No new feature development.

- **Target:** preview branch `phase16-ai-analyst` → `https://phase16-ai-analyst.mildmate-new.pages.dev`, preview D1 `mildmate-db` (`85ce2f41-463a-43fa-8485-181e983b8fd4`).
- **Not touched:** production deployment, `mildmate-db-prod` data, production Clerk configuration, production collectors/crons, checkout/payments, Claude API configuration.
- **Feature branch:** `feature/marketing-ai-analyst-r1`.

---

## 1. Outcome summary

| Item | Result |
|---|---|
| Phase 14 Opportunity Engine schema on preview D1 | **FIXED** (was absent; additive migrations applied) |
| Phase 13 profitability/cost-model schema on preview D1 | **FIXED** (was absent; additive migrations applied) |
| Collector fact tables the scoring core reads | **FIXED** (created empty; honest NULL components, never zero) |
| Phase 16 `marketing_actions` schema + `[TEST/DEMO]` fixtures | **PASS** (intact, initial state preserved) |
| Phase 16 approval/rejection/review logic | **PASS** via automated suite; live authenticated run **BLOCKED** (see §7) |
| Phase 15 Command Center page + API contract | **PASS** (code/contract verified read-only); authenticated payloads **BLOCKED** (see §7) |
| Five reported risk warnings | **EXPECTED** (1 environment limitation + 4 intentional fixtures) — nothing reset or hidden |
| Data Confidence `0 / INSUFFICIENT_SIGNAL` | **EXPECTED LIMITATION** (honest insufficient-signal state; not faked) |
| Regression suite | **263/263 passing (28 files)** |
| Source/runtime bundle parity | **IN SYNC** (rebuild differs only by a wrangler temp-path comment) |

---

## 2. Root causes of the reported preview problems

1. **Missing preview D1 migrations (the real defect).** Preview D1 held only the Phase 03
   analysis layer (`042`) plus application tables. The entire Phase 13 cost/profitability layer
   (`053`), the Phase 14 opportunity engine (`054`/`055`), and the collector fact tables the
   scoring core reads (`046`/`048`/`049`/`050`) were **never applied** to preview. Hence
   `GET /api/admin/analysis/opportunity` correctly answered
   `available:false / OPPORTUNITY_SCHEMA_UNAVAILABLE` with the message
   *"…Apply migration 054_opportunity_engine.sql."* — the UI was reporting the truth, not a bug.
2. **No opportunity snapshot exists in preview.** Snapshot creation is an **authenticated admin
   action** (`POST /api/admin/analysis/opportunity/recompute`, the "Recompute scores" button on the
   Data Analyst dashboard) or the production-only weekly cron (`marketing-sync-worker`, Monday
   05:00 UTC). Preview has no cron and no snapshot had ever been generated, so "Top opportunity
   score" and "Scored opportunities" were empty. (Production: 596 snapshot rows, latest
   `score_date` 2026-11-06.)
3. **Preview has no collector data and no recent sales.** `ga4_funnel_daily`, `gsc_search_daily`,
   `etsy_listing_daily` and `google_ads_campaign_daily` are empty in preview by design, and the
   preview sales fixtures are all dated ≤ 2026-09-01. The Phase 13 growth-signal layer therefore
   reports `confidence.value = 0` / `insufficient_signal` — the documented behaviour
   ("missing or immature sources reduce confidence without forcing synthetic zero values").
4. **Five risk warnings are working-as-designed detectors, not defects.** Four are triggered by
   deliberately named preview fixtures; one is the absence of any collector in preview. See §5.
5. **"Sales orders (window): 0" is a filter effect, not a data gap.** `initFilters()` on the
   Command Center pre-fills the date inputs with a **28-day window** (today-27 → today), so the
   page always sends `?start=…&end=…`. Every preview sales fixture predates that window. The
   unfiltered aggregate is **10 commercial orders / ฿22,722 / 16 units**.

---

## 3. Exact changes made

### 3.1 Preview D1 — additive migrations applied (preview only)

Applied in dependency order to `mildmate-db` via `wrangler d1 execute … --file`:

| Order | Migration | Purpose |
|---|---|---|
| 1 | `046_gsc_analytics.sql` | `gsc_search_daily` + GSC views |
| 2 | `048_ga4_analytics.sql` | `ga4_funnel_daily` + GA4 views |
| 3 | `049_etsy_analytics.sql` | `etsy_listing_master`, `etsy_listing_daily` + views |
| 4 | `050_google_ads_analytics.sql` | `google_ads_campaign_daily` + views |
| 5 | `053_profitability_layer.sql` | `cost_model_products`, `cost_model_channel_fees`, `cost_model_shipping` + profitability views + labelled seeds |
| 6 | `054_opportunity_engine.sql` | `opportunity_score_models`, `opportunity_scores`, `cost_model_products.modeled_price_thb` |
| 7 | `055_ga4_multi_property.sql` | GA4 property identity + scope-aware uniqueness + model-registry demand sub-weights |
| 8 | `062_ga4_website_canonical_freshness.sql` | canonical website GA4 freshness view (production parity) |

- `056_ga4_property_unique_rebuild.sql` was **intentionally not applied**: the file carries an
  explicit "do NOT execute until explicitly approved" human gate and is superseded by the rebuild
  already contained in `055`.
- No migration file was modified. No preview rows were deleted or rewritten. Fixtures preserved.
- The preview `d1_migrations` ledger is already incomplete (3 recorded rows for a much larger
  schema); it was deliberately **not** rewritten, because recording a partial set would misstate
  history. The applied set is recorded here instead.

### 3.2 Application code

**No application code change was required or made.** The defect was environmental. Consequently:

- `public/_worker.js` is unchanged (no functions/workers source touched).
- No preview redeployment was necessary: the deployed bundle already contains the Phase 16 code,
  and D1 is a separate binding read at request time.

---

## 4. Preview D1 schema & data readiness (after remediation)

- Objects: **48 tables / 39 views** (was ~30 / 17).
- `opportunity_score_models`: `v1` present with
  `{"momentum":30,"profitability":30,"channel_fit":20,"demand":15,"strategic":5,"conversion":0,"demand_ga4":80,"demand_gsc":20}`.
- `cost_model_products`: **3 rows**, all `cost_source='verified'` (owner-verified fixed-price
  products). **0 formula rows** — those are generated by the authenticated
  `POST /api/admin/cost-model/recalculate` action (production has 29).
- `cost_model_channel_fees`: 8 seeded channels · `cost_model_shipping`: 8 seeded channels.
- `opportunity_scores`: **0 rows** (no snapshot yet — see §7).
- `marketing_actions`: **3 rows** — `[TEST/DEMO]` fixtures in their documented initial state
  (2 × `proposed`, 1 × `approved` with `approved_budget = 3000 THB`).
- Unchanged fixtures: 30 products, 14 `sales_orders`, 14 `sales_order_items`, 18 `custom_quotes`,
  45 `reviews`, 1 `sync_runs` row.

**All nine input queries used by `scripts/opportunity-core.mjs` were executed read-only against
preview D1 and resolve successfully** (no `no such table` / `no such column`), so the recomputation
workflow can safely populate scores from preview inputs once triggered by an authenticated admin.

---

## 5. The five risk warnings — classification

The Command Center's "Active risk warnings" KPI counts
`/api/admin/analysis/data-quality → data_quality.warnings`. Preview produces exactly five:

| # | Warning text (as produced) | Triggering preview evidence | Classification |
|---|---|---|---|
| 1 | `Last successful sync was 87430 minutes ago (threshold 30).` | The only `sync_runs` row is a `notion` mapping-sync fixture from **2026-09-07**. Preview has no collectors. | **Expected environment limitation** — not a defect. (Secondary observation: the response's `thresholds.note` still references the retired Make.com 15-minute cadence; the string is not rendered by any dashboard, so it was left unchanged.) |
| 2 | `1 active item(s) have no Product_ID.` | `sales_order_items.id=22` (order `EXACT-001`) has `product_id = NULL`, `item_status='active'`. | **Intentional preview test data** — exercises the unmapped-item path (`mapped_item_pct = 91.7%`). |
| 3 | `1 commercial order(s) have no items.` | `sales_orders.source_order_id='NOITEM-001'` — its single item is `item_status='removed'`, so it is excluded from `analysis_active_items`. | **Intentional preview test data** (fixture literally named `NOITEM-001`). |
| 4 | `1 order(s) have an unknown status value.` | `sales_orders.source_order_id='BADSTATUS-001'`, `status='weird'`. | **Intentional preview test data** (fixture named `BADSTATUS-001`). |
| 5 | `1 unknown source label(s) present.` | `sales_orders.source_system='randomshop'` (`UNK-001`). | **Intentional preview test data** (fixture named `UNK-001`). |

No preview defect was found among the warnings. They were **not** reset, suppressed or hidden.
`zero_total_orders = 0`, so the sixth possible warning does not fire — confirming the count of five.
The `TEST-MAKE-001` smoke-test order remains excluded from commercial KPIs by the documented guardrail.

---

## 6. Freshness reconciliation

- **Preview** `sync_runs` contains one row (2026-09-07, `notion`, success) → the freshness warning
  above is structurally unavoidable in preview and is **not** an analytics-health signal.
- **Preview vs production separation preserved:** no production collector was triggered, no
  scheduled job or cron configuration was altered, and no production D1 row was written or read
  for modification. Production reads performed were read-only comparisons
  (`cost_model_products`: 32 rows = 29 formula + 3 verified; `opportunity_scores`: 596 rows,
  latest `score_date` 2026-11-06).
- After remediation, the collector freshness views exist in preview with **0 rows**, so they report
  `status: "empty"` / `available: true` rather than being absent — an honest unavailable state.

---

## 7. AI Analyst workflow verification — status and blocker

### Verified in this cycle

| Layer | Evidence |
|---|---|
| Automated handler suite | `workers/api/__tests__/ai-analyst-r1.test.ts` (14) + `ai-analyst-ui.test.ts` (4) + `marketing-command-center-ui.test.ts` (9) + `data-quality-api-contract-r1.test.ts` (1) — all PASS |
| Deployed route gating (live preview) | `GET /api/admin/ai-analyst/contract` → `401 {"error":"Unauthorized: bearer token required"}` |
| Contract data availability (read-only, preview D1) | 30 canonical products; `marketing_actions` readable; reviewed-outcome query readable; `opportunity_scores` now **readable** (was `schema_unavailable`) |
| Scoring-core inputs (read-only, preview D1) | all 9 input queries resolve |
| Fixtures in documented initial state | 3 rows: `proposed` / `proposed` / `approved` (budget 3000 THB) |

### Blocked from this environment

Executing the approval / rejection / review transitions against **live preview** requires an
authenticated admin request. This environment cannot produce one:

- The preview API gateway (`functions/api/[[path]].ts` → `authorizeAdminForRoute`) classifies
  `/api/admin/ai-analyst/*` as a **browser_admin** route and requires a Clerk **Bearer** token —
  the `X-Admin-Secret` fallback is not accepted for this route.
- The Pages **Preview** environment has no `ADMIN_SECRET` (documented since
  `Phase13_Growth_Signals_UI_Remediation_2026-10-12.md`), and no `CLERK_SECRET_KEY`.
- No Clerk session can be minted here: the Clerk CLI is unauthenticated (`clerk doctor --json`
  → "Not logged in") and the Development instance does not yet authorize the preview origin.

**Not a code defect.** The workflow logic itself was already verified earlier in this cycle at the
handler level against live preview D1 (approve/reject executed by the real handler; baseline
snapshot, approved budget and audit timestamps persisted) and is covered by the automated suite.
The remaining gap is *browser* acceptance, which is the owner's step (§9).

---

## 8. Regression results

- Focused suites (Phase 14–16 + auth + data-quality): **41/41 passing**.
- Full repository suite: **263/263 passing (28 files)**.
- `workers/api/__tests__/phase5-quote-funnel.test.ts`: the previously reported date-sensitive
  failure is fixed and stable — the Ads fixture dates are relative (`utcDaysAgo(1)` / `utcDaysAgo(0)`,
  stale case `utcDaysAgo(30)`); the application rule
  (`days_since_latest_report > 4` → `warning`) is unchanged.
- **Bundle parity:** rebuilding `public/_worker.js` via `extract-worker.ps1` produced a bundle whose
  only difference from the committed artifact is wrangler's non-deterministic temp path inside a
  generated comment (`// ../.wrangler/tmp/pages-XXXXX/functionsRoutes-0.NNNN.mjs`). Source and
  runtime are in sync; the working tree was restored to the committed artifact and is clean.

---

## 9. Owner acceptance tests (preview only, in order)

### Step 0 — unblock sign-in (still required)

Clerk Dashboard → **Development instance → API keys → Allowed origins** → add
`https://phase16-ai-analyst.mildmate-new.pages.dev` (optionally `https://mildmate-new.pages.dev`) → save.

### Step 1 — Command Center loads

Sign in at `https://phase16-ai-analyst.mildmate-new.pages.dev/super-admin/marketing/`.
Expected KPI values **today**, with the default 28-day filter:

| KPI | Expected | Why |
|---|---|---|
| Top opportunity score | `—` | no snapshot yet (Step 2 creates it) |
| Scored opportunities | `— / —` | same |
| Data confidence | `0` `insufficient_signal` | no GA4/GSC/Etsy rows, no 28-day sales in preview |
| Active risk warnings | `5` | §5 |
| Sales orders (window) | `0` | 28-day filter vs fixtures dated ≤ 2026-09-01 (unfiltered = 10) |
| New quotes (30d) | `0` | 18 quotes, all created 2026-05-19 … 2026-06-13 |

**The "Phase 14 Opportunity Engine schema unavailable / apply migration 054" state must no longer appear.**
Instead the opportunity panel shows "No scored rows yet."

### Step 2 — generate the first opportunity snapshot

On `/super-admin/marketing/data-analyst/`: click **Recalculate costs** (populates the 29 formula cost
rows) then **Recompute scores**. Expected: a `score_date = 2026-11-07` snapshot, and the Command
Center's "Top opportunity score" / "Scored opportunities" KPIs populate. Then return to the Command
Center and confirm the numbers appear there too.

### Step 3 — AI Analyst approval loop

In the **AI Analyst (Phase 16) — Advisory Only** panel:

1. **Approve** *[TEST/DEMO] Refresh Standard Fitted Sheet* → `approved`, your admin email recorded as approver, baseline snapshot stored.
2. **Reject** *[TEST/DEMO] Deep Pocket Fitted Sheet Ads test* → `rejected` with your email + timestamp; it must never show a result class or executed state.
3. **Record review** on *[TEST/DEMO] Marine Fitted Sheet content update* → choose a result class, add a lesson → `reviewed`.
4. Press **Refresh** → all three states persist with your email in the audit columns.
5. **Generate AI recommendations** → expect the explicit "AI provider not configured … Nothing generated or stored" message and no new rows.

### Step 4 — reset

`npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql`

---

## 10. Recommendation

**GO for owner acceptance**, conditional on Step 0 (Clerk Development instance allowed-origins entry)
and Step 2 (authenticated recompute) — both of which are owner-side actions, not code defects.
**NO-GO for production release** of Phase 16 at this time: the AI provider is intentionally not
configured, Google Ads purchase attribution remains UNVERIFIED (Phase 12 open), and owner browser
acceptance has not yet been recorded.
