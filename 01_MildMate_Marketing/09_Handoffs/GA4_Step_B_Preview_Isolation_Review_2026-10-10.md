# GA4 Step B — Preview Isolation Review — 2026-10-10

**Scope of this round:** analysis only. No push, deploy, GTM publish, GA4 change, D1 change, or cloud configuration change was made. Commit `96881f1` (Step a) remains local and UNDEPLOYED.

---

## 1. Documentation reconciliation

**Verdict: your reading of the Cloudflare documentation is correct; my Step (a) report was wrong on this point.**

From https://developers.cloudflare.com/pages/functions/wrangler-configuration/ (fetched 2026-10-10, "Production and preview deployments"):

> "To deploy the configuration for preview deployments, you can run the same command as above while on a branch you have configured to work with preview deployments. **This will set the configuration for all preview deployments, not just the deployments from a specific branch. Pages does not currently support branch-based configuration.**"

And ("Source of truth"):

> "your Wrangler file is the source of truth. You will be able to see, but not edit, the same fields when you log into the Cloudflare dashboard."

Consequences, answering the four questions:

1. **Does deploying the QA branch change project-level Preview configuration?** YES. `wrangler pages deploy` from `ga4/remediation-isolated` applies this branch's `[env.preview.vars]` as the **project-level Preview configuration** for `mildmate-new`. My Step (a) description of the vars as "deployment-scoped" was incorrect; they are project-Preview-scoped. (The one mitigating nuance — a later deploy from another branch carries *that* branch's toml and re-applies its own values — does not make the state branch-isolated; it makes it last-deploy-wins, which is worse in a different way, see 3.)
2. **Do existing immutable Preview deployments retain their runtime bindings?** YES. Pages deployments are immutable snapshots; the bindings doc's "Redeploy your project for the binding to take effect" confirms running deployments keep their deploy-time bindings. The **existing** Stripe hardening preview deployment keeps its current (analytics-disabled) configuration until someone redeploys it. The exposure is therefore to *future* redeploys, not the running ones.
3. **Could other Preview branches inherit the staging analytics variables?** YES, in two ways: (a) any deployment path that uses the project-level Preview configuration (dashboard/CI-initiated deploys) inherits whatever the last wrangler deploy set; (b) any branch whose toml omits the analytics vars inherits the project-level value. Because the state flips with each deploy's toml, "who last deployed" decides whether previews get staging analytics — unpredictable shared mutable state.
4. **Could existing Stripe hardening Preview environments be affected?** The currently-running deployment: NO (immutable). Any redeploy of it: inherits project-level Preview config at redeploy time. Under the Step (a) toml flip, a redeploy in the window where the QA branch deployed last would load `GTM-M9DMRGCD` on the Stripe preview — GA/GTM network calls and staging-property traffic during Stripe UAT. Not a production risk, but exactly the cross-contamination you asked about.

**Conclusion:** deploying commit `96881f1` as-is would change shared project configuration. Not approved for deployment in that form — correct call.

## 2. Runtime branch-guard evidence (`CF_PAGES_BRANCH`)

- **Documented, build-time:** the Pages build-configuration doc lists `CF_PAGES_BRANCH` = "branch-name-of-current-deployment" among system environment variables "injected by default" (build context).
- **Runtime evidence available to date:** (a) our local `wrangler pages dev` runtime log lists `env.CF_PAGES_BRANCH ("ga4/remediation-isolated")` as a Function-runtime environment variable — wrangler simulating the live runtime; (b) Cloudflare's Pages Functions system-variables documentation for the deployed runtime could not be retrieved this session to definitively confirm runtime exposure of `CF_PAGES_BRANCH` in production Functions (`context.env`). Community/SDK sources indicate it is available, but per your instruction I am **not** treating that as proof.
- **Fail-closed status (verified in code):** the guard requires an exact branch match; an absent/empty `CF_PAGES_BRANCH` yields `stagingAnalyticsActive = false` → injected config `{"nonProductionApproved":false}` → analytics disabled. The guard cannot fail open. Worst case if runtime exposure were absent: the QA preview silently has no analytics (a verification gap, never a data-leak).
- **Definitive runtime proof is obtainable only post-deploy** (see §6 step 3) — a production-runtime fetch of the injected config. This is a deliberate check, not an assumption.

## 3. Separate QA project (`mildmate-ga4-qa`) evaluation

A dedicated Pages project deployed from this branch is **viable without substantial refactoring** — the GA4 implementation resolves per-host, and the branch guard passes (`CF_PAGES_BRANCH` = `ga4/remediation-isolated` on the deployment regardless of project).

| Concern | Assessment |
|---|---|
| GTM/GA4 | Staging IDs served by the same branch-gated middleware. Isolated by construction. |
| D1 | Bind `mildmate-db` (preview DB `85ce2f41`) — staging-only, per existing toml pattern. |
| R2 | `mildmate-assets` is a single shared bucket; image serving is read-only but admin upload exists — avoid exercising admin uploads on QA. |
| Stripe | Set sandbox-only secrets on the QA project; no production keys. |
| Webhooks | Stripe webhooks target `www.mildmate.com/api/webhook/stripe` only; the QA project receives none — purchase flows run via mocked API (already how the test harness works). |
| Email | `NON_PROD_EMAIL_ALLOWED=false` (Resend never sends). |
| Clerk | Dev instance (`pk_test_*`) — works on any domain; no production interaction. |
| Turnstile | Widgets are hostname-bound; `mildmate-ga4-qa.pages.dev` must be added to the Turnstile widget config for form flows (dashboard change, owner action) — not needed for GA4 QA itself. |
| Deployment config | Needs its own project name (toml `name` or `--project-name`), no domain cutover, trivially deletable. |
| Cost/maintenance | Second project = second secrets surface + config drift risk between the two tomls. |

No code refactoring required; only deployment/secrets configuration.

## 4. Option comparison and recommendation

| Criterion | A: `mildmate-new` + env vars (Step a as committed) | A′: `mildmate-new`, **code-gated** staging config, toml reverted | B: separate `mildmate-ga4-qa` project |
|---|---|---|---|
| Shared-config mutation | **Yes** (project Preview config rewritten) | **None** (toml unchanged from RC; activation lives in deployed code keyed on `CF_PAGES_BRANCH`) | None (own project) |
| Other previews affected | Redeploys inherit QA vars | **Never** — their deployments lack the staging branch name | Never |
| Production protection | Host check + resolver (strong) | Same (strong) | Strong (separate project) |
| Test fidelity | Full runtime, real D1 preview | Full runtime, real D1 preview | Full runtime, real D1 preview |
| Complexity | Lowest but unsafe as committed | **Smallest sound change: revert toml flip + move staging IDs into the branch-gated middleware constants** (~10 lines + bundle rebuild) | Moderate (project, secrets, Turnstile, drift) |
| Failure mode | Shared preview state flips per deploy | Fail-closed (no branch match → disabled) | Fail-closed |

**Recommendation: Option A′** — the smallest technically sound solution. Revert `wrangler.toml` to `ANALYTICS_NON_PROD_ENABLED = "false"` and carry the owner-authorized staging IDs (`GTM-M9DMRGCD` / `G-E8W6FZE6LP`) as constants inside the branch-gated middleware path, activated only when `CF_PAGES_BRANCH === 'ga4/remediation-isolated'` on a non-production host. This satisfies "Pages does not support branch-based configuration" by moving the branch scoping into deployed code, mutating zero project-level configuration. Fail-closed by construction. Option B remains the fallback if you prefer hard project separation.

## 5. Pre-deployment verification procedure (Option A′, after approval)

1. Apply A′ locally (toml revert + middleware constants + `extract-worker.ps1` bundle rebuild); vitest green (57+ tests, updated toml/middleware assertions).
2. Deploy preview (only after explicit approval): `npx wrangler pages deploy ./public --project-name=mildmate-new --commit-dirty=true --branch=ga4/remediation-isolated --no-bundle`.
3. **Runtime branch-guard proof (definitive):** fetch the preview URL HTML → `runtime-analytics-config` must read `{"environment":"staging","nonProductionApproved":true,"gtmId":"GTM-M9DMRGCD","ga4Id":"G-E8W6FZE6LP","enabled":true}`. If it reads `nonProductionApproved:false`, runtime `CF_PAGES_BRANCH` is unavailable — fail-closed, and we move to Option B.
4. **Scope proof:** fetch the existing Stripe hardening preview URL → its `runtime-analytics-config` must still show `nonProductionApproved:false`; verify no `ANALYTICS_*` variables appear in its runtime.
5. Grep production identifiers: staging deploy serves zero `GTM-KLJZZM9` / `G-0GWVSPJLVJ` / `G-ESL161CNBV` references.
6. Run `qa-browser-matrix.mjs` (staging IDs) against the preview URL.
7. After you configure + publish the staging GTM container: run `qa-gtm-e2e.mjs` (real tag execution), Tag Assistant on the preview URL in all three consent states, DebugView on "MildMate - Staging QA" (stream `16100062854`).
8. Optionally: enable Cloudflare Access on the `*.pages.dev` preview domain for the QA window (owner action; keeps crawlers out of the staging property).

## 6. Updated GO/NO-GO for Step (b)

**NO-GO for deploying commit `96881f1` as-is** — it mutates project-level Preview configuration (docs-confirmed), exposing other previews' redeploys to staging-analytics inheritance.

**GO (conditional)** for the A′ revision: one local commit (toml revert + code-gated staging IDs + bundle rebuild + test updates), then the deploy above. All changes stay local until you approve both the revision and the deployment.
