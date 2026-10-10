# GA4 Staging Integration Plan — 2026-10-10

**Status: PLAN ONLY — awaiting review.** No push, deploy, GTM publish, production change, or payment initiation has occurred or will occur until separately approved.

**Staging resources (owner-provided):** GTM container `GTM-M9DMRGCD` ("MildMate - Staging QA") · GA4 property "MildMate - Staging QA", stream `16100062854`, Measurement ID `G-E8W6FZE6LP` (USD).
**Never used in staging:** `GTM-KLJZZM9`, `G-0GWVSPJLVJ`, `G-ESL161CNBV` (harness hard-refuses these).

---

## 1. Preview build configuration (wrangler.toml only — no code change)

`functions/_middleware.ts` → `buildAnalyticsRuntimeConfigScript()` already injects the runtime analytics config on every page and already supports env-driven staging analytics: on any non-production host it reads `ANALYTICS_NON_PROD_ENABLED` / `ANALYTICS_NON_PROD_GTM_ID` / `ANALYTICS_NON_PROD_GA4_ID`. The current preview block in `wrangler.toml` ships `ANALYTICS_NON_PROD_ENABLED = "false"`.

**Change (preview scope only, ~3 lines):**

```toml
[env.preview.vars]
# ...existing entries unchanged...
ANALYTICS_NON_PROD_ENABLED = "true"
ANALYTICS_NON_PROD_GTM_ID = "GTM-M9DMRGCD"
ANALYTICS_NON_PROD_GA4_ID = "G-E8W6FZE6LP"
```

Resulting injected config on every preview page:
`{"environment":"staging","nonProductionApproved":true,"gtmId":"GTM-M9DMRGCD","ga4Id":"G-E8W6FZE6LP","enabled":true}`

**Isolation properties (verified in code):**
- `isProductionHost()` forces the production branch of the resolver for `www.mildmate.com` / `mildmate.com` **regardless of env vars** — the production site can never pick up staging IDs even if a var leaks.
- `resolveMildMateAnalyticsConfig()` additionally rejects any non-production config that carries production IDs (`non_production_ids_match_production_blocked` — test-asserted).
- `env.production.vars` defines no analytics overrides; the `[env.preview.vars]` block applies only to preview-branch deployments.
- `analytics-env.js` production constants are untouched; local dev (localhost) without the env vars stays analytics-disabled.

**Preview deploy command (pending approval, NOT executed):**
```powershell
git add wrangler.toml ; git commit -m "chore(analytics): enable staging analytics on preview (GTM-M9DMRGCD / G-E8W6FZE6LP)"
npx wrangler pages deploy ./public --project-name=mildmate-new --commit-dirty=true --branch=ga4/remediation-isolated --no-bundle
```
(`--no-bundle` mandatory per AGENTS.md; no `functions/` edits are needed for this integration, so no bundle rebuild is required.)

## 2. Staging GTM configuration (GTM-M9DMRGCD) — setup instructions

All work in the staging container. Nothing is published from this session; use **Preview** (Share Preview link) for validation, then publish once after review approval.

1. **Tag "GA4 Config — Staging QA"** — Google tag
   - Tag ID: `G-E8W6FZE6LP`
   - Trigger: **Initialization — All Pages**
   - (GTM itself loads only after consent; the site pushes the consent default before `gtm.js`, so Google's built-in consent checks are active for this tag.)
2. **Tag "GA4 Event — ecommerce router"** — GA4 Event
   - Measurement ID: `G-E8W6FZE6LP`
   - Event Name: `{{Event}}` (built-in dataLayer event variable)
   - Trigger: **Custom Event**, regex `(?i)^(view_item|add_to_cart|view_cart|begin_checkout|purchase)$`
   - **Send Ecommerce data: ON**, data source: **Data Layer** (reads the `ecommerce` object the site pushes alongside `eventModel`)
   - Event parameters if the tag UI demands explicit mapping: `currency = {{DLV - eventModel.currency}}`, `value = {{DLV - eventModel.value}}`, `items = {{DLV - eventModel.items}}`
3. **Variables to create (if absent):** Data Layer Variables `eventModel` (Default value `{}`), `ecommerce`, `eventModel.transaction_id`, `eventModel.value`, `eventModel.currency` (Version 2).
4. **Ads isolation:** the container must contain **zero** Google Ads tags — no `__awct`, no conversion linker, no `__googtag` pointing at `G-0GWVSPJLVJ`. Production Ads conversion tags live only in the production container `GTM-KLJZZM9`, which staging never loads.
5. **Consent:** do NOT add a Consent Initialization tag or consent overrides — the site script owns consent (`gtag('consent','default')` denied-all before `gtm.js`, `consent update` on user choice).
6. Workspace hygiene: name the workspace "staging-qa-ecommerce", add a version note referencing this plan before the eventual publish.

## 3. Consent design (Necessary / Analytics / Marketing)

Already implemented in isolation (commit `be22c0a`, pending owner sign-off recorded in the gate-closure report):

| Category | Storage key | Consent signals granted when accepted |
|---|---|---|
| Necessary (shown as "Essential" in UI; label rename optional) | `essential` (always true) | none |
| Analytics | `analytics` | `analytics_storage` |
| Marketing | `marketing` | `ad_storage`, `ad_user_data`, `ad_personalization` |

- Default all denied before any Google tag executes; update on user choice; Analytics acceptance never grants Marketing (test-asserted); historical analytics-only records parse to marketing-denied; withdrawal re-pushes denied state on a loaded container.
- UI note for approval: the banner's "Accept All Cookies" grants both categories; the modal's toggles grant them independently. Reject grants neither. Until a "Cookie Settings" re-open link ships, returning users cannot change or withdraw consent from the UI (code path ready, UI entry point is the flagged follow-up).

## 4. Ads-production isolation (requirement 5)

- Staging GTM container carries no Ads tags (§2.4).
- Staging consent defaults deny `ad_storage/ad_user_data/ad_personalization`; Ads-classified tags in any container would still require Marketing consent.
- Production Ads conversion tags are only in `GTM-KLJZZM9`; staging resolves to `GTM-M9DMRGCD` via the preview env vars and can never load the production container.
- Test harness additionally blocks `googleadservices.com` / `doubleclick.net` at the network layer and fails if any such request occurs.
- No payments are initiated and no synthetic purchase is sent anywhere: purchase events are driven by a locally-mocked order-confirmed API response; the harness intercepts GA4 `/g/collect` locally (204) unless explicitly run in passthrough mode for §5c.

## 5. Validation procedure

**a. Local e2e (real GTM container execution, zero network egress):**
```powershell
npx wrangler pages dev ./public --port 8799
$env:GTM_TEST_ID="GTM-M9DMRGCD"; $env:GA4_TEST_ID="G-E8W6FZE6LP"
node scripts/qa-gtm-e2e.mjs
```
Asserts: each of `view_item`, `view_cart`, `begin_checkout`, `purchase` fires exactly once (no duplicates) with correct parameters; consent default precedes container start; no unpaid purchase; zero Ads-endpoint hits; all hits carry `tid=G-E8W6FZE6LP`.

**b. Preview verification (after approved deploy):** fetch any preview page and confirm the injected `runtime-analytics-config` shows the staging IDs; re-run the browser matrix with `BASE` pointed at the preview URL.

**c. Tag Assistant (real network, test stream only):** tagassistant.google.com → connect to the preview URL (Share Preview from GTM-M9DMRGCD).
- Consent denied state: container loads no tags; no `g/collect` requests.
- Consent accepted (Analytics only): GA4 Config fires; ecommerce events flow; Marketing stays denied.
- Consent accepted (Analytics + Marketing): all five events fire; parameters visible in Tag Assistant (Data Layer + event tabs).
- Confirm: no duplicate GA4 events (single Config hit + single event hit each), no Ads tags present, purchase only after the verified-order mock.

**d. GA4 DebugView:** property "MildMate - Staging QA" (stream `16100062854`) shows the same events in real time. This is the definitive end-to-end proof.

## 6. Isolation checklist (run before and after preview deploy)

1. `GTM-KLJZZM9`, `G-0GWVSPJLVJ`, `G-ESL161CNBV` absent from staging container config and from all staging-injected runtime config (grep).
2. Harness production-ID refusal test still exits 2 (verified 2026-10-10).
3. Production host resolver check: `resolveMildMateAnalyticsConfig({hostname:'www.mildmate.com'})` returns production IDs regardless of staging vars (vitest-asserted).
4. Preview HTML `runtime-analytics-config` matches §1 exactly (no production IDs).
5. Staging GTM tag inventory: only the 2 tags in §2; zero Ads tags.
6. CSP on pages allows `googletagmanager.com` + `google-analytics.com` (verified 2026-10-10).
7. Stripe untouched: no checkout API changes; purchase path exercised only via mocked API responses; no Stripe objects created.

## 7. awaiting approval

- (a) Apply the §1 wrangler.toml preview-var change (commit) — safe, preview-scoped.
- (b) Execute the §1 preview deploy to `<branch-hash>.mildmate-new.pages.dev`.
- (c) Publish staging GTM container after Tag Assistant review (owner action).
- (d) Owner sign-off on the §3 consent UI design (recorded as blocker in the gate-closure report).
