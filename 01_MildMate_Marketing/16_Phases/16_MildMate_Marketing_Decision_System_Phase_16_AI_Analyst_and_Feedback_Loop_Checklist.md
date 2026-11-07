> **DOC RECONCILIATION (2026-11-06).** Authoritative phase-status matrix: `01_MildMate_Marketing/09_Handoffs/Phase_Documentation_Systematic_Reconciliation_2026-11-06.md`.

# MildMate Marketing Decision System — Phase 16
## AI Analyst & Marketing Action Feedback Loop

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

Use AI to interpret trusted analytics, record approved actions, and measure whether actions worked.

## Prerequisites / Confirmed Baseline

- [x] Marketing Command Center and Opportunity Engine working. *(Phases 14 and 15 are implemented for current owner-approved scope.)*
- [x] Data Confidence available.
- [ ] Canonical multi-source metrics/history available in D1. *(full dependency set requires Phases 10-15 implementation)*

## Task Checklist

- [ ] Define AI input contract.
- [ ] Provide AI only canonical product data and approved analytical metrics.
- [ ] Provide Opportunity Score and Data Confidence.
- [ ] Provide historical action/results context where relevant.
- [ ] Define standard recommendation output: Product, Action, Channel, Why, Budget/Test, Success Target, Confidence, Review Date.
- [ ] Prevent AI from inventing Product_ID, revenue, costs, or metrics.
- [ ] Create `marketing_actions` table or approved equivalent.
- [ ] Store recommendation reason.
- [ ] Store baseline metrics.
- [ ] Store approved budget.
- [ ] Store start/end/review dates.
- [ ] Store human approval/rejection.
- [ ] Store post-action metrics.
- [ ] Classify result: positive / neutral / negative / inconclusive.
- [ ] Record lessons learned.
- [ ] Feed verified historical action outcomes into future AI context.
- [ ] Add AI Analyst panel to Marketing Command Center.
- [ ] Add Action History and Results views.
- [ ] Add audit trail for AI-generated vs human-approved content.
- [ ] Define safe fallback when data confidence is insufficient.

## Deliverables

- [ ] AI Analyst recommendation interface.
- [ ] `marketing_actions` history.
- [ ] Approval workflow.
- [ ] Baseline/result comparison.
- [ ] Feedback loop.

## Verification / Test Checklist

- [ ] AI recommendation cites only available metrics.
- [ ] Low-confidence case results in cautious/insufficient-data recommendation.
- [ ] Rejected recommendation is preserved but not marked executed.
- [ ] Approved action stores baseline.
- [ ] Post-action review calculates result using canonical metrics.
- [ ] AI cannot write canonical sales/product facts.

## Definition of Done

- [ ] System can answer WHAT / WHERE / WHY / HOW MUCH / WHAT NEXT / DID IT WORK.
- [ ] Approved marketing actions and their outcomes are historically auditable.
- [ ] AI acts as analyst/advisor, not source of truth.

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

- [ ] Record files changed.
- [ ] Record migrations/API routes/UI routes created or changed.
- [ ] Record tests performed and results.
- [ ] Record unresolved issues and risks.
- [ ] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only phase-scoped changes with a clear Git commit message.
- [ ] Prepare final system reconciliation and operating handoff.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 16 — AI Analyst & Marketing Action Feedback Loop`

## Droid Working Instruction

> Work on **Phase 16 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.

---
## Reconciliation Pass 4 (2026-11-06)

Status verified: **NOT STARTED** for Phase 16 deliverables (AI recommendation layer, `marketing_actions` persistence, closed-loop action feedback workflow).

Baseline correction:

- **Phase 15 is now complete** for the current owner-approved command-center/auth scope (production source `45a436f`).
- Phase 16 remains pending implementation and should proceed only after explicit scope approval.

---
## Owner Decision — AI Model Selection (2026-11-07)

- **Claude Haiku 5.5 is the owner's selected AI model for the FUTURE Phase 16 AI integration stage.**
- **API integration is deferred.** Do NOT configure `AI_API_KEY`, `AI_API_BASE`, or `AI_MODEL` at this stage. No paid AI generation is authorized.
- **Integration caveat (important):** the current Phase 16 implementation is provider-neutral over the **OpenAI-compatible** `chat/completions` protocol (default base `https://api.deepseek.com`). Anthropic's Messages API is a different protocol (different endpoint, `x-api-key` auth header, and request/response schema). Calling Claude Haiku 5.5 will require an **adapter change** in `workers/api/admin-ai-analyst.ts` (`callAiProvider`). Do not assume the existing integration can call Anthropic as-is.
- Until a provider is configured, the AI Analyst panel shows the explicit `ai_available:false` state and generates nothing (by design).

## TEST/DEMO Fixtures — Preview Only (2026-11-07)

- Three clearly labeled workflow fixtures were inserted directly into **preview D1 `marketing_actions`** (database `mildmate-db`, ID `85ce2f41-...`) via wrangler — no application code changes, no fixture code paths that could ever run in production.
- Fixture markers: `source='human'`, `ai_model='TEST-DEMO-FIXTURE'`, title prefix `[TEST/DEMO]` — always distinguishable from genuine future AI recommendations (`source='ai'`).
- Contents: 2 rows `status='proposed'` (one to approve, one to reject) + 1 row `status='approved'` with illustrative baseline snapshot and `approved_budget=3000 THB` (for the post-action review step). Values are illustrative only; no fabricated marketing performance, no customer PII.
- Production D1 (`mildmate-db-prod`) was never touched.
- Fixture IDs are re-issued on every reset (`AUTOINCREMENT`); always address rows by their `[TEST/DEMO]` title, never by a hard-coded ID.
- Documented reset (preview only): `npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql`. The script deletes every `TEST-DEMO-FIXTURE%` row (including temporary `TEST-DEMO-FIXTURE-SIM` rows) and restores the three canonical fixtures.

---
## Phase 16 UI & Human-Approval Workflow Verification (2026-11-07)

**Target:** preview branch deployment `phase16-ai-analyst` → `https://phase16-ai-analyst.mildmate-new.pages.dev`, preview D1 `mildmate-db` (`85ce2f41-...`). Production deployment and `mildmate-db-prod` were not touched.

### Verification layers used

| Layer | What it proves |
|---|---|
| Live preview HTTP (`GET /api/admin/ai-analyst/*`, unauthenticated) | Route is deployed and Clerk-gated: `401` without an admin session, `200` for reads once authenticated. |
| Real handler + **live preview D1** (`wrangler dev --remote` harness importing `workers/api/admin-ai-analyst.ts`) | Approve and reject executed the real handler code against the real preview database; baseline snapshot, approved budget and audit timestamps persisted. |
| Real handler + **local D1 replica** (schema-identical, seeded with the same fixtures) | Full lifecycle including all four result classes, status filters, rejected-row guarantees, and the feedback loop. |
| **Live preview D1** direct execution of the handler's exact `approve` / `reject` / `review` statements | The production SQL path applies cleanly on the live preview database. |
| Automated suite | `workers/api/__tests__/ai-analyst-r1.test.ts` (14 tests) + `workers/api/__tests__/ai-analyst-ui.test.ts` (4 tests), plus the full repository suite. |

### Result checklist

| # | Check | Result |
|---|---|---|
| 1 | Preview AI endpoint deployed and Clerk-gated | PASS (401 unauthenticated) |
| 2 | Command Center UI renders the AI Analyst panel (generate button, filters, actions table, review form) | PASS (markers present on the live preview page) |
| 3 | `GET /actions` lists fixtures; `?status=` filters work | PASS |
| 4 | `GET /contract` returns canonical products, data confidence, per-source freshness, Ads UNVERIFIED flag | PASS (30 canonical products, `ads_unverified=true`) |
| 5 | Approve stores baseline snapshot + approved budget | PASS |
| 6 | Re-approving an approved action is blocked | PASS (`409 INVALID_TRANSITION`) |
| 7 | Reject stores actor + timestamp and preserves the row | PASS |
| 8 | Reviewing a rejected action is blocked | PASS (`409 INVALID_TRANSITION`) |
| 9 | Invalid `result_class` is rejected | PASS (`400 BAD_RESULT_CLASS`) |
| 10 | All four result classes persist (`positive`, `neutral`, `negative`, `inconclusive`) with post-metrics + lessons | PASS |
| 11 | Rejected rows are never marked executed (no `approved_at`, `reviewed_at`, `result_class`, post-metrics, budget or baseline) | PASS |
| 12 | Reviewed outcomes feed the next AI contract (`past_outcomes`) | PASS |
| 13 | Audit separation: AI (`source='ai'`) vs human (`source='human'`) vs test data (`ai_model='TEST-DEMO-FIXTURE'`, `[TEST/DEMO]` title prefix) | PASS |
| 14 | No provider configured → `ai_available:false`, nothing generated or stored | PASS |
| 15 | Fixtures reset to the documented initial state after verification | PASS (3 rows: proposed / proposed / approved) |

### Findings and limitations (no code change required)

- **Remote-dev session limitation:** in `wrangler dev --remote`, body-bearing requests (`PUT` / `POST`) start returning `503` with an empty body after a direct `wrangler d1 execute` touches the same database, while `GET` keeps working. This is a Cloudflare remote-dev-session behaviour, not an application defect. For write testing use a local `wrangler dev` replica or the deployed preview URL with a signed-in Clerk admin session.
- **Actor attribution on the non-browser path:** approvals performed with the `X-Admin-Secret` fallback record an empty actor (`approved_by=''`). The deployed preview route is Clerk-only, so browser approvals are attributed to the signed-in admin email (covered by the unit test *approve captures baseline snapshot and human attribution*).
- **Preview data gaps are reported, not hidden:** preview D1 had no `opportunity_scores` table at that time, so the contract returned `schema_unavailable: ["opportunity_scores"]` with `opportunities: []`; preview data confidence resolved to `low` (missing / stale collector runs), which forces caution flags on recommendations, as designed. *(Superseded 2026-11-07: the Phase 13/14 schema has since been applied to preview D1 — see "Preview System Verification & Remediation (2026-11-07)" below. The contract no longer lists `opportunity_scores` as unavailable; `opportunities` stays empty until the first authenticated recompute.)*
- **No AI provider is configured**, so the panel intentionally shows the "AI provider not configured" state and stores nothing.

### Owner browser acceptance steps (preview only)

1. Open `https://phase16-ai-analyst.mildmate-new.pages.dev/super-admin/marketing/` and sign in with the Clerk super-admin account.
2. Scroll to **"AI Analyst (Phase 16) — Advisory Only"**. The three `[TEST/DEMO]` rows must appear: *Refresh Standard Fitted Sheet* (proposed), *Deep Pocket Fitted Sheet Ads test* (proposed, caution flag visible), *Marine Fitted Sheet content update* (approved).
3. Click **Approve** on *Refresh Standard Fitted Sheet* → status becomes *approved*, the row records your admin email as approver, and the baseline snapshot is stored.
4. Click **Reject** on *Deep Pocket Fitted Sheet Ads test* → status becomes *rejected* with your email and timestamp; it must never show a result class or executed state.
5. Click **Review** on *Marine Fitted Sheet content update* → the review form opens; pick a result class (positive / neutral / negative / inconclusive), add a note, submit → status becomes *reviewed*.
6. Press **Refresh**. All three states must persist, and the audit columns (approver / rejecter / reviewer) must still show your email.
7. Click **Generate AI recommendations** → expect the explicit "AI provider not configured … Nothing generated or stored" message, and no new rows.

### Reset after owner testing

`npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql` restores the three fixtures to their initial states and removes any rows created during owner testing.

---
## Preview Sign-in Blocker — Root Cause & Correction (2026-11-07)

**Symptom:** owner acceptance of the Phase 16 preview was blocked by a recurring Clerk **Development** sign-in loop on `https://phase16-ai-analyst.mildmate-new.pages.dev` (hosted sign-in `kind-joey-29.accounts.dev`): the sign-in page stayed on a blank/loading state with repeated network requests and the browser never reached the Command Center. Production Clerk auth (`accounts.mildmate.com`) was unaffected.

### Root cause (demonstrated from live evidence, not inferred)

| # | Layer | Evidence |
|---|---|---|
| 1 | The Clerk **Development** instance does not authorize the preview origin | Live instance config (`allowedOrigins`) = localhost / `127.0.0.1` / `0.0.0.0` / `lvh.me` variants + `https://clerk.accounts.dev` + `https://*.clerk.accounts.dev` + `http://*.clerk.accounts.dev` + `https://kind-joey-29.accounts.dev/default-redirect` — **no `*.pages.dev` origin**. Clerk's own runtime warning captured in the preview browser: `Clerk: Redirect URL https://phase16-ai-analyst.mildmate-new.pages.dev/auth/clerk-return/?next=/super-admin/marketing/ is not on one of the allowedRedirectOrigins, falling back to the default redirect URL.` After a successful sign-in Clerk therefore returns to `https://kind-joey-29.accounts.dev/default-redirect`, never to the preview. |
| 2 | The preview callback never consumed the Development handshake (the loop itself) | `functions/auth/clerk-return/[[path].ts` calls `consumeClerkHandshake()` (`workers/api/clerk-handshake.ts`), which recognises only the **Production** `__clerk_handshake` payload. The Development token `__clerk_db_jwt` was stripped by `stripAuthParams()` and never consumed. Live proof: the callback answered `302 → kind-joey-29.accounts.dev/sign-in` **identically with and without** `__clerk_db_jwt` — sign-in → callback → sign-in. |
| 3 | Production was never affected | Production signs in through the Production instance and the `__clerk_handshake` payload, which `consumeClerkHandshake()` verifies against the configured production JWKS (`CLERK_ISSUER` / `CLERK_JWKS_URL`); `workers/api/clerk-verify.ts` fails closed on production hosts when the production issuer is missing. The production callback path is untouched by this correction. |
| 4 | The preview API already trusts the Development instance | The development JWKS (`https://kind-joey-29.clerk.accounts.dev/.well-known/jwks.json`) returns keys, and the preview admin API answers `Unknown signing key` for a production-signed token — the preview verifies against the **Development** keys, as intended. |
| 5 | The hosted sign-in page itself renders | `GET https://kind-joey-29.accounts.dev/sign-in?redirect_url=…` → `200` with the "Sign in to MildMate Beddings" form; the blank appearance is the repeated bounce of the loop plus Development-instance latency, not a broken sign-in page. |

### Correction (preview-only)

1. **Code (this branch):** `functions/auth/clerk-return/[[path].ts` forwards the Clerk Development handshake to the destination page on preview/local hosts only (`*.pages.dev`, `localhost`, `127.0.0.1`, `::1`): the `__clerk_db_jwt` token is carried to `next` instead of being dropped. The Clerk SDK the app already loads (`public/js/clerk.js` → `hasClerkHandshakeParams()` → `initClerk()` → `waitForSessionAndCleanup()`) then finishes the handshake, establishes the session and removes the token from the address bar. Production hosts keep the exact previous behaviour — there is no dev-handshake branch on production at all.
2. **Clerk instance configuration (owner action, required):** the Development instance must authorize the preview hostname; otherwise Clerk refuses to return the browser to the preview after sign-in, and no application code can override Clerk's origin authorization. Clerk Dashboard → **Development instance → API keys → Allowed origins** → add `https://phase16-ai-analyst.mildmate-new.pages.dev` (optionally `https://mildmate-new.pages.dev` for the project host). This environment cannot perform that step: the Clerk CLI is not authenticated (`clerk doctor --json` → "Not logged in") and no `CLERK_SECRET_KEY` / `CLERK_PLATFORM_API_KEY` exists locally.

### Regression coverage

- New suite `workers/api/__tests__/clerk-dev-handshake-preview.test.ts` (6 tests): the preview forwards the dev handshake (plain and suffixed parameter name), keeps the `next` query string, refuses an off-site `next` (no open redirect), the preview without a handshake still redirects to the dev sign-in portal, and the production callback is unchanged.
- `workers/api/__tests__/phase5-quote-funnel.test.ts`: the Ads fixture dates are now relative (`utcDaysAgo(...)`), so the "fresh Ads data" case can no longer go stale as the calendar moves. The application rule (`days_since_latest_report > 4` → `warning`) is unchanged — only the test fixture changed.
- Full repository suite after the change: **263/263 passing (28 files)**.

### Preview delivery

- Preview deployment `8b335081-a353-464f-9f7c-27bedddd3f9c` (branch `phase16-ai-analyst`, source `3ead520f`) → **https://phase16-ai-analyst.mildmate-new.pages.dev**.
- Commits on `feature/marketing-ai-analyst-r1` (pushed to origin): `9ff24506` (callback fix + regression suite), `a0db84a8` (date-relative Phase 5 fixture), `3ead520f` (this record).
- Live verification after deployment: callback **with** `__clerk_db_jwt` → `302` to `/super-admin/marketing/?__clerk_db_jwt=…` (no sign-in bounce); callback **without** a handshake → `302` to the dev hosted sign-in (unchanged); production callback → `302` to `accounts.mildmate.com` (unchanged); `/api/admin/ai-analyst/contract` → `401` unauthenticated; Command Center AI panel markers present; preview D1 fixtures unchanged (3 rows, ids 14/15/16).
- Headless-browser trace of the corrected callback: callback → app page (handshake parameter present) → app page (parameter removed by the Clerk SDK) with **zero** hosted sign-in portal loads, i.e. the recurring loop no longer occurs.
- Production was not deployed to, and `mildmate-db-prod` was not touched.

### Owner browser acceptance test (preview only)

1. Clerk Dashboard → Development instance → API keys → Allowed origins → add `https://phase16-ai-analyst.mildmate-new.pages.dev` → save.
2. Open `https://phase16-ai-analyst.mildmate-new.pages.dev/super-admin/marketing/` → **Sign in** → complete the Clerk form.
   **Pass:** the browser lands back on `/super-admin/marketing/` (the URL may briefly show `?__clerk_db_jwt=…`, which the app removes automatically) with the **AI Analyst (Phase 16)** panel visible and the three `[TEST/DEMO]` rows listed.
   **Fail:** the browser returns to `kind-joey-29.accounts.dev/sign-in` or `/default-redirect` → the preview hostname is still missing from Allowed origins (step 1).

---
## Preview System Verification & Remediation (2026-11-07)

Consolidated verification and correction of the **existing** Phase 16 preview implementation. Full detail: `01_MildMate_Marketing/09_Handoffs/Phase_16_System_Verification_Handoff_2026-11-07.md`. No new feature development; production deployment, `mildmate-db-prod`, production Clerk, collectors/crons and the Claude API were all left untouched.

### Reported symptoms → verdict

| # | Reported symptom | Root cause | Verdict |
|---|---|---|---|
| 1 | "Phase 14 Opportunity Engine schema unavailable / UI requests `054_opportunity_engine.sql`" | The Phase 13/14 schema and the collector fact tables the scoring core reads were **never applied to preview D1** (preview held only the `042` analysis layer). The UI was reporting the truth. | **FIXED** — additive migrations applied to preview D1 (§ changes) |
| 2 | "Top opportunity score: unavailable" | No opportunity snapshot had ever been generated in preview. Snapshot creation is an **authenticated admin action** ("Recompute scores") or the production-only weekly cron. | **FIXED schema / EXPECTED LIMITATION for the snapshot** — owner action (acceptance step 2) |
| 3 | "Scored opportunities: unavailable" | Same as #2. | Same as #2 |
| 4 | "Data Confidence: 0 / INSUFFICIENT_SIGNAL" | Preview has no GA4/GSC/Etsy/Ads rows and no sales inside the 28-day window; the Phase 13 growth layer reports the honest insufficient-signal state rather than synthesising values. | **EXPECTED LIMITATION** — deliberately not faked to HIGH |
| 5 | "Active risk warnings: 5" | 1 environment limitation + 4 deliberately named preview fixtures. | **EXPECTED** — working as designed; nothing reset or hidden |
| 6 | "Sales orders: 0" | `initFilters()` pre-fills the Command Center date inputs with a **28-day window**, and every preview sales fixture is dated ≤ 2026-09-01. Unfiltered aggregate = **10 orders / ฿22,722 / 16 units**. | **EXPECTED** — filter effect, not a data gap |
| 7 | "Last successful sync ≈ 87,430 minutes ago" | Preview `sync_runs` holds a single `notion` mapping-sync fixture from 2026-09-07; preview has no collectors. | **EXPECTED ENVIRONMENT LIMITATION** |

### Risk-warning classification (all five)

| Warning | Triggering evidence | Classification |
|---|---|---|
| `Last successful sync was 87430 minutes ago (threshold 30).` | only `sync_runs` row = 2026-09-07 fixture | Expected environment limitation |
| `1 active item(s) have no Product_ID.` | `sales_order_items.id=22` (order `EXACT-001`), `product_id = NULL` | Intentional preview test data |
| `1 commercial order(s) have no items.` | order `NOITEM-001` (its only item is `item_status='removed'`) | Intentional preview test data |
| `1 order(s) have an unknown status value.` | order `BADSTATUS-001`, `status='weird'` | Intentional preview test data |
| `1 unknown source label(s) present.` | order `UNK-001`, `source_system='randomshop'` | Intentional preview test data |

No preview defect found among the warnings. `zero_total_orders = 0`, which confirms the count of exactly five.

### Changes applied (preview D1 only)

Additive migrations applied to `mildmate-db` in dependency order: `046_gsc_analytics`, `048_ga4_analytics`, `049_etsy_analytics`, `050_google_ads_analytics`, `053_profitability_layer`, `054_opportunity_engine`, `055_ga4_multi_property`, `062_ga4_website_canonical_freshness`. `056_ga4_property_unique_rebuild` was deliberately **not** applied (it carries an explicit approval gate and is superseded by the rebuild inside `055`).

- **No migration file was modified. No preview row was deleted or rewritten. Fixtures preserved** (3 `[TEST/DEMO]` rows still `proposed` / `proposed` / `approved`).
- **No application code change was required or made** — the defect was environmental. `public/_worker.js` is unchanged and no preview redeployment was necessary (D1 is read at request time).
- The preview `d1_migrations` ledger is already incomplete (3 rows for a far larger schema) and was deliberately not rewritten; the applied set is recorded in the handoff.

### Phase 14–16 verification matrix

| Area | Verdict |
|---|---|
| Phase 14 model registry (`v1`, demand sub-weights 80/20) on preview | **PASS** |
| Phase 14 opportunity schema + read route | **FIXED** (schema) / **PASS** (route stays read-only) |
| Phase 14 score snapshot in preview | **EXPECTED LIMITATION** — owner recompute action (production has 596 rows, latest `score_date` 2026-11-06) |
| Phase 13 cost model on preview | **FIXED** (3 verified rows seeded; 29 formula rows require the authenticated "Recalculate costs" action) |
| All 9 scoring-core input queries resolve on preview D1 | **PASS** (read-only execution) |
| Phase 15 Command Center page + contract shape | **PASS** (renders; KPI semantics verified against the handler's exact queries) |
| Phase 15/16 authenticated API payloads | **BLOCKED** from this environment (see below) |
| Phase 16 `marketing_actions` schema + fixtures | **PASS** |
| Phase 16 approve / reject / review logic | **PASS** via automated suite; live authenticated run **BLOCKED** (see below) |
| Phase 16 feedback loop (`past_outcomes`) | **PASS** (code + tests) |
| No AI provider configured → explicit unavailable state | **PASS** (`ai_available:false`, nothing stored) |

### Blocker (documented, not a code defect)

Live authenticated verification of the approval workflow requires a Clerk **Bearer** token: the preview gateway classifies `/api/admin/ai-analyst/*` as a `browser_admin` route and does not accept the `X-Admin-Secret` fallback, the Pages **Preview** environment has no `ADMIN_SECRET` or `CLERK_SECRET_KEY`, and no Clerk session can be minted here (Clerk CLI unauthenticated; the Development instance does not yet authorize the preview origin). The workflow was already verified earlier in this cycle at the handler level against live preview D1, and is covered by the automated suite; only *browser* acceptance remains, which is the owner's step.

### Regression results

- Focused suites: **41/41 passing** · full repository suite: **263/263 passing (28 files)**.
- `phase5-quote-funnel.test.ts` date-sensitive failure: fixed and stable (fixture dates now relative via `utcDaysAgo(...)`; the application rule is unchanged).
- Source/runtime bundle parity: rebuilding `public/_worker.js` reproduced the committed bundle except for wrangler's non-deterministic temp-path comment — **in sync**, working tree clean.

### Owner acceptance tests (preview only)

0. **Unblock sign-in:** Clerk Dashboard → Development instance → API keys → Allowed origins → add `https://phase16-ai-analyst.mildmate-new.pages.dev`.
1. **Command Center loads** at `/super-admin/marketing/`. Expected today with the default 28-day filter: top opportunity score `—`, scored opportunities `— / —`, data confidence `0 insufficient_signal`, risk warnings `5`, sales orders `0`, new quotes (30d) `0`. **The "Phase 14 schema unavailable / apply migration 054" state must no longer appear** — the opportunity panel now reads "No scored rows yet."
2. **Generate the first snapshot:** on `/super-admin/marketing/data-analyst/` click **Recalculate costs**, then **Recompute scores**; confirm a `score_date = 2026-11-07` snapshot and that the Command Center KPIs populate.
3. **AI Analyst loop:** approve *[TEST/DEMO] Refresh Standard Fitted Sheet*; reject *[TEST/DEMO] Deep Pocket Fitted Sheet Ads test* (must never show a result class or executed state); record a review (result class + lesson) on *[TEST/DEMO] Marine Fitted Sheet content update*; refresh and confirm all three states persist with your admin email in the audit columns; then click **Generate AI recommendations** and confirm the explicit "AI provider not configured … Nothing generated or stored" message.
4. **Reset:** `npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql`.

**Recommendation:** GO for owner acceptance, conditional on steps 0 and 2 (both owner-side actions). NO-GO for production release of Phase 16 while the AI provider is intentionally unconfigured, Google Ads attribution remains UNVERIFIED (Phase 12 open), and owner browser acceptance is unrecorded.

---
## Final UI Acceptance Before Claude Integration (2026-11-07)

**Full pack:** `09_Handoffs/Phase_16_UI_Workflow_Owner_Acceptance_2026-11-07.md`

### Owner-confirmed status

| Item | Status |
|---|---|
| Phase 16 preview Super Admin | PASS (owner browser) |
| Marketing Command Center | PASS (owner browser) |
| Phase 14 preview schema | Repaired (preview D1 only) |
| Phase 16 automated workflow tests | PASS |
| Phase 16 human approval workflow (browser) | **OWNER ACCEPTED — 2026-11-07** |
| Production | Unchanged |

Phase 14–16 schema audits and the Clerk authentication investigation are **closed and not repeated**. No further Clerk configuration changes are made while the current preview session works.

### Fixtures verified live (read-only, 2026-11-07)

Preview D1 `marketing_actions` holds all three `[TEST/DEMO]` fixtures in their initial states: **#14** `proposed` (Standard Fitted Sheet, `seo`, conf 80) → approve; **#15** `proposed` (Deep Pocket Fitted Sheet, `google-ads`, conf 55, `caution=1`) → reject; **#16** `approved` (Marine Fitted Sheet, `overall`, `approved_budget=3000 THB`, conf 70) → post-action review. Fixtures are frozen until the owner completes acceptance.

### Acceptance script (7 steps)

1. AI Analyst panel + recommendation details render correctly (three rows, all columns, filter buttons work).
2. Approve the **proposed Standard Fitted Sheet** action (#14).
3. Reject the **proposed Deep Pocket Fitted Sheet Ads** action (#15) — no result class, no executed state.
4. Review the **approved Marine Fitted Sheet** action (#16) with a result classification and a lesson learned.
5. Verify Action History, approved budget (฿3,000 on #16), baseline snapshot, and human audit records.
6. Refresh and confirm all decisions persist (from D1, not browser state).
7. Confirm **Generate AI recommendations** reports that no provider is configured and stores nothing.

### Behaviour notes recorded so they are not misread as defects

- **Approved budget on #14 stays `—`.** The panel's Approve button sends no budget and the handler uses `COALESCE(?3, approved_budget)`, so a null budget leaves the column unchanged. The ฿3,000 value is fixture #16's. Correct behaviour.
- **Audit attribution** (`approved_by` / `rejected_by` / `reviewed_by`) is read from the JWT `email` claim. If the Development instance's session token omits `email`, the audit column renders blank — a token-claim nuance to report as an observation, not an authorization failure; decisions still persist.
- **The "Next Actions with Human Review" card is a browser-local tracker**, separate from the D1-backed AI Analyst panel. Workflow persistence is proven by the AI Analyst card after refresh.
- **Default 28-day filter** on the Command Center legitimately yields `—` / `0` for several KPIs; documented in the Preview System Verification section above.

### Provider decision recorded — Anthropic Claude (deferred)

- **Provider:** Anthropic Claude API. **Model (owner-stated identifier):** `claude-haiku-5-5`.
- **Deferred:** no API key, no Cloudflare AI secret change, no adapter implementation, no paid generation, no production change.
- **Adapter required:** the current `callAiProvider()` is OpenAI-compatible (`chat/completions`, `Authorization: Bearer`); Anthropic's Messages API uses a different endpoint, `x-api-key` auth, and request/response schema, so Claude cannot be called without a native adapter.
- **Remaining requirements:** (1) native Messages API adapter preserving the existing OpenAI-compatible path; (2) validate the exact versioned model ID against Anthropic's live model list — do not assume the owner-stated string is callable as-is; (3) set `AI_API_KEY` (+ optional `AI_API_BASE` / `AI_MODEL`) at the next stage only; (4) preserve `validateRecommendations()` grounding and the `ai_available:false` default; (5) mirror `workers/api/admin-ai-analyst.ts` into `public/index.js` + `public/_worker.js` and rebuild the bundle via `extract-worker.ps1`; (6) extend the Phase 16 suite with adapter tests.
- **Credential notice:** Anthropic API credentials will be required for the next stage, and only after separate authorization.

### Guardrails observed

No production deployment, no `main` merge, no D1 write, no Clerk change, no application code change, no AI provider configuration. Preview deployment and existing test/acceptance evidence preserved.

### Next step

Owner runs steps 1–7 in the preview browser. On PASS, acceptance is recorded here and the Claude integration requirements above become the next authorized workstream. Then stop and await separate authorization for Claude integration.

---
## Owner Acceptance Closure & UI Cleanup (2026-11-07)

**Phase 16 UI & Human Approval Workflow: OWNER ACCEPTED — 2026-11-07.**

The owner completed the authenticated preview workflow and verified persistence after a hard refresh. Confirmed results:

| # | Check | Result |
|---|---|---|
| 1 | #14 Standard Fitted Sheet: `PROPOSED` → `APPROVED` | PASS |
| 2 | #15 Deep Pocket Fitted Sheet: `PROPOSED` → `REJECTED` | PASS |
| 3 | #16 Marine Fitted Sheet: `APPROVED` → `REVIEWED` | PASS |
| 4 | #16 result classification `POSITIVE` | PASS |
| 5 | #16 lessons learned saved and persisted | PASS |
| 6 | #16 approved budget `THB 3,000` preserved | PASS |
| 7 | All three statuses persisted after Ctrl+F5 | PASS |
| 8 | Rejected action remained non-executed | PASS |

These were `[TEST/DEMO]` fixture records, not real marketing actions. **No real AI generation and no measurable marketing improvement is claimed** — no provider is configured, by design.

### UI defects corrected (AI Analyst panel only)

Two display defects in `public/super-admin/marketing/index.html`:

- **Baseline metrics readability.** `baseline_metrics_json` was rendered as a raw escaped JSON blob. It now renders as labeled, humanized field/value rows (nested objects flattened with `·`, arrays summarized as `N item(s)`, capped at 12 fields / 3 levels), with an explicit empty state for missing or unreadable records. Stored D1 data is never modified; all keys and values are escaped.
- **Missing post-action metrics.** A reviewed action with no metrics rendered `Post: "null"`. It now shows **`No post-action metrics recorded`** (and *Post-action record unreadable* for unparseable records), preserves the saved result classification and lessons, and labels the row **Manually selected result (no metrics recorded)** vs **Result backed by recorded metrics** so a human classification is never presented as a metrics-verified outcome.

Helpers live in a marked block (`METRICS_RENDER_BEGIN` / `METRICS_RENDER_END`) in the page's inline script. No other Command Center component changed.

### Tests

- New `workers/api/__tests__/ai-analyst-metrics-render.test.ts` — 23 tests covering structured baseline rendering, humanized keys, array/large-record handling, missing and malformed metric data, HTML escaping of keys/values/labels/lessons, reviewed-without-metrics empty state, manual-vs-metrics-backed distinction, and renderer regression guards. The suite extracts and exercises the real functions from the shipped page.
- Extended `workers/api/__tests__/ai-analyst-r1.test.ts` — added Action History persistence across approve/reject/review and the `post_metrics_json = "null"` storage shape.
- Focused run: 52/52 pass (metrics-render 23, ai-analyst-r1 16, ai-analyst-ui 4, marketing-command-center-ui 9).

### Fixtures

The three owner-accepted demo rows remain in preview D1 in their accepted states and were **not** reset. Reset remains owner-authorized-only: `npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql`.

### Remaining Phase 16 items

1. **Anthropic Claude integration** — deferred; requires a native Messages API adapter, exact model-ID validation, and credentials. Separate authorization required.
2. **Opportunity snapshot on preview** — Command Center still shows `—` for top opportunity score / scored opportunities because preview `opportunity_scores` is empty. Owner-side step: *Recalculate costs* → *Recompute scores* on the Data Analyst tab.
3. **Google Ads purchase attribution** — UNVERIFIED (Phase 12 open); independent business track.
4. **Production release of Phase 16** — NO-GO while the AI provider is intentionally unconfigured.

### Guardrails observed

No production migration, no production deployment, no `main` merge, no Clerk configuration change, no collector modification. Application change limited to the AI Analyst display layer. No AI provider credentials configured and no paid AI generation.