# GA4 Option A′ Implementation Report — 2026-10-10

**Status: local implementation and validation complete. NOT deployed.** Boundary honored: no push, no deploy, no GTM publish, no Cloudflare setting changes, no migrations, no payments.

---

## 1. Final commit + diff

**Commit `fd4467b`** — 4 files, +34/−30:

- `wrangler.toml` — Preview analytics vars reverted to the approved baseline: `ANALYTICS_NON_PROD_ENABLED = "false"`, staging IDs **removed** from the toml. Full diff vs RC `327e667` is now **4 comment lines only** — every value byte-identical to baseline. No shared Preview configuration changes of any kind.
- `functions/_middleware.ts` — staging IDs as code constants (`ANALYTICS_STAGING_GTM_ID = 'GTM-M9DMRGCD'`, `ANALYTICS_STAGING_GA4_ID = 'G-E8W6FZE6LP'`), activated only when **both**: (1) non-production host, and (2) `CF_PAGES_BRANCH` is non-empty AND in `ANALYTICS_STAGING_BRANCHES` (`ga4/remediation-isolated`). Unknown or missing branch identity fails closed (`nonProductionApproved:false`, analytics disabled). The `ANALYTICS_NON_PROD_*` env-var path was removed from the logic — staging can no longer be toggled via shared config.
- `public/_worker.js` — bundle rebuilt via `extract-worker.ps1` (verified: guard + staging IDs present, no formdata junk).
- `workers/api/__tests__/analytics-isolation.test.ts` — assertions updated: toml must contain **no** staging IDs and `ENABLED = "false"`; middleware must contain the branch set, both staging ID constants, and the `branch !== ''` fail-closed check; Stripe safeguards + production D1 binding unchanged.

## 2. Test results

| Suite | Result |
|---|---|
| vitest (4 files, incl. updated isolation suite) | **57/57 passing** |
| Browser matrix (14 checks, staging IDs, local dev) | **14/14 passing** — GTM requested exactly once as `gtm.js?id=GTM-M9DMRGCD`; consent flows, ecommerce contract, purchase gating, prod-ID blocking all green |
| Config injection with **zero manual bindings** | Local `wrangler pages dev` (branch `ga4/remediation-isolated`) injects `{"environment":"staging","nonProductionApproved":true,"gtmId":"GTM-M9DMRGCD","ga4Id":"G-E8W6FZE6LP","enabled":true}` — branch gate activates from code alone, no env vars, no test rewrites |
| Real-container e2e harness | Isolation invariants green (zero Ads-endpoint hits; consent default → update → `gtm.js` order against a real container load). GA4 events not yet fired: staging GTM container has no published tag configuration — unchanged external gate |
| Bundle checks | Guard present; staging IDs in bundle (by design, code-gated); no formdata junk; deterministic extraction |

## 3. Configuration comparison

| Dimension | RC `327e667` | `96881f1` (superseded) | Now (`fd4467b`) |
|---|---|---|---|
| `wrangler.toml` values vs RC | — | `ANALYTICS_NON_PROD_ENABLED="true"` + 2 staging IDs in shared Preview config | **Values identical to RC**; 4 explanatory comment lines added |
| Shared Pages Preview config effect of deploying | none | **Mutated** (all preview deployments inherit staging analytics until next differing deploy) | **None** — toml matches RC |
| Staging activation mechanism | n/a | Preview env vars | Deployed code: `CF_PAGES_BRANCH` + non-prod host, fail-closed |
| Other previews (incl. Stripe hardening) on redeploy | analytics disabled | Inherit staging vars (risk window) | **Cannot activate** — their branch is not in `ANALYTICS_STAGING_BRANCHES` |
| Production | Host check + resolver | Unchanged | Unchanged (same guards; production branch deploys serve production config regardless) |
| Stripe sandbox vars / Preview D1 / email suppression | `STRIPE_ENV_MODE="test"`, `NON_PROD_STRIPE_ALLOWED="true"`, `NON_PROD_EMAIL_ALLOWED="false"`, preview DB `mildmate-db` | Untouched | Untouched (test-asserted) |
| Production secrets / D1 / R2 bindings | — | Untouched | Untouched (toml binding blocks byte-identical to RC) |

## 4. Runtime branch-verification procedure (read-only, executed after eventual deployment approval)

1. Note the preview deployment URL (`https://<hash>.mildmate-new.pages.dev`).
2. **Branch-guard runtime proof:** `GET <preview>/` → `runtime-analytics-config` must equal the staging config in §2. This simultaneously proves `CF_PAGES_BRANCH` is available in the production Functions runtime. If it reads `nonProductionApproved:false` → the guard failed closed; do not proceed with GTM work; fall back to Option B (separate project).
3. **Scope proof (other previews untouched):** `GET <stripe-hardening-preview>/` → its `runtime-analytics-config` must still read `{"nonProductionApproved":false,...}` with no GTM/GA4 IDs. Also confirm in the Pages dashboard that project-level Preview variables show `ANALYTICS_NON_PROD_ENABLED="false"` (unchanged by our deploy).
4. **Production non-involvement:** this deploy is a preview deployment (non-production branch) — it cannot alter the production deployment; additionally verify `https://www.mildmate.com/` serves `nonProductionApproved` absent (production branch of the config) with production IDs as before.
5. Only then: Tag Assistant on the preview URL (3 consent states), `qa-gtm-e2e.mjs`, DebugView on the staging property (stream `16100062854`) — after you configure and publish `GTM-M9DMRGCD`.

## 5. GO/NO-GO for isolated Preview deployment

**GO** — commit `fd4467b` deploys with zero project-level configuration mutation; staging analytics activates solely via the fail-closed code gate; all local suites green. The only external dependency for full e2e validation remains the staging GTM container's tag configuration + publish (owner action), which can happen before or after the preview deploy.

Awaiting your approval to deploy.
