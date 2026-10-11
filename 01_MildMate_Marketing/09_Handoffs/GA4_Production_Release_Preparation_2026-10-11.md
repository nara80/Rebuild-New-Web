# GA4 Production Release Preparation — 2026-10-11

Branch `ga4/production-release-prep` (local): production master `7029c35` + merge of `ga4/remediation-isolated` (`75f8602`) + Cookie Settings entry point (`f64d30f`). All local; **no deploy, no push, no GTM publish, no GA4/Ads change, no payment**.

## A. Production Readiness

### Confirmed existing production configuration (preserved as-is)
- Website `www.mildmate.com` ← Cloudflare Pages production deploys from local `master`; latest `224ca19e` @ `7029c35` (+ 1 phase-13 commit beyond `origin/master`).
- GA4 property `308922589`, stream `3376637775`, measurement `G-0GWVSPJLVJ`, container `GTM-KLJZZM9`, Ads `AW-18373693725` (Purchase - GTM primary, Purchase secondary), Conversion Linker.
- Current production pages bootstrap GTM **unconditionally** via legacy `gtag/js` snippets, and analytics-env.js is absent from production.
- Production Stripe is dashboard-managed (live keys); the merged `wrangler.toml` has **no top-level Stripe overrides** — test-mode vars are `[env.preview.vars]`-scoped only (verified).

### Required website changes — ALL ALREADY IMPLEMENTED on the release branch
The merge delivers, for production hosts, via the resolver (PROD_GTM_ID=`GTM-KLJZZM9`, PROD_GA4_ID=`G-0GWVSPJLVJ`): consent UI with Necessary/Analytics/Marketing, permanent Cookie Settings entry (footer, bilingual), `mm-consent` cookie, `__mildmateAddConsentListener`, transition events, zero site-side `gtag('consent',…)` commands, removal of ALL legacy GA4 bootstraps (`G-ESL161CNBV`: 0 occurrences; `gtag/js`: 0 in public HTML), and the canonical 5-event dataLayer contract. CSP unchanged (no `unsafe-eval`).

### Required GTM changes (plan only — nothing published)
See §C/B. Adaptations of staging Version 2 with production IDs. Staging IDs must NOT be copied.

### Remaining genuine blockers
1. **Migration 057 must be applied to production D1 (backup-first) BEFORE the website deploy.** The release branch carries the Stripe hardening (RC `327e667` is an ancestor); its checkout endpoint returns 500 when `stripe_webhook_events` is missing (test-asserted). Deploying without the migration breaks checkout. If the Stripe release is to stay strictly separate, the alternative (cherry-picking GA4-only, excluding the hardening) is untested and not recommended.
2. **GTM workspace verification** (from the pre-deploy gate): variable bodies, Tag-C body equality, grant-after-load template test — evidence still outstanding.
3. **Deployment automation:** production deploys run from local `master` via manual wrangler — the release requires merging this branch to local `master` (owner action; push to origin optional). No CI auto-deploy was observed; flagged so the release window is explicitly controlled.
4. Transition window (site deploy → GTM publish ordering) — handled by the runbook below; expect a brief Ads reporting dip if website deploys first.

## B. Exact change inventory

| # | Item | Current (production) | Proposed | Reason | Rollback |
|---|---|---|---|---|---|
| W1 | `public/**` (76+ pages) | Legacy unconditional GA4 bootstrap (`G-ESL161CNBV`/`gtag/js`) | Removed; consent-gated `analytics-env.js` loader with `GTM-KLJZZM9`/`G-0GWVSPJLVJ` | Single consent-gated load path; dedupe | `git revert` merge on `master`, redeploy |
| W2 | `public/js/cookie-consent.js` | Binary analytics banner | Necessary/Analytics/Marketing UI + permanent footer "Cookie Settings" entry (TH: ตั้งค่าคุกกี้) + `mm-consent` cookie + listener + transition events | §3 requirements 1–6 | revert W1-merge commit |
| W3 | `public/js/analytics-env.js` | absent | Resolver (prod allowlist), consent gate, deferred GTM loader, 5-event dataLayer contract | canonical events + consent gate | as W1 |
| W4 | `functions/_middleware.ts` | pre-hardening | Stripe hardening + branch-gated staging analytics (inert on prod host) | isolated staging QA | as W1 |
| W5 | `public/_worker.js` | old bundle | Rebuilt `BCE8B2DB…52B9B19D52` | runtime parity | as W1 |
| W6 | `wrangler.toml` | no explicit env blocks | Explicit prod/preview D1+R2 blocks (SAME IDs) + preview-scoped vars | hardening lineage | as W1 |
| G1 | GTM tag "UA GA4 — Google Tag" (G-0GWVSPJLVJ, send_page_view=true, All Pages) | Unconditional fire at page load | Keep tag + ID + pageview; add condition `{{mmSignal - Analytics}} equals granted` to its Initialization trigger; ADD second trigger `CE - Analytics Granted` | Consent-controlled firing; mid-page opt-in refire; no double pageview (INIT and CE are mutually exclusive per §B matrix) | remove added trigger/condition in GTM (version revert) |
| G2 | New GTM tag "GA4 - Ecommerce Events" (G-0GWVSPJLVJ) | absent | GA4 Event, `{{Event}}`, Data Layer ecommerce, trigger `CE - GA4 Ecommerce` (5-event regex + analytics condition), additional consent `analytics_storage` | Ecommerce measurement | delete tag (version revert) |
| G3 | GTM tag "Google Tag AW-18373693725" (Initialization - All Pages) | Unconditional | Add condition `{{mmSignal - Marketing}} equals granted`; ADD second trigger `CE - Marketing Granted` (`mildmate_marketing_granted`); additional consent `ad_storage`/`ad_user_data`/`ad_personalization` | Marketing-consent-controlled Ads, independently of Analytics | remove conditions/triggers |
| G4 | "Purchase - GTM" + "Purchase" Ads conversion tags | `CE - purchase` trigger, existing label/value mapping | UNCHANGED mappings; add marketing-consent condition + additional consent checks | Marketing gating | remove conditions |
| G5 | Conversion Linker (All Pages) | Unconditional | Add marketing-consent condition + additional consent checks | sets Ads cookies — requires consent | remove condition |
| G6 | New: "MildMate Consent Bridge" tag + template | absent | Staging template verbatim, Consent Initialization - All Pages | Consent default/update single owner | remove tag; prior version restore |
| G7 | New: "MildMate Consent Signal" variable template + 2 instances | absent | CSP-safe strict fail-closed cookie parser | replace blocked Custom JS variables | delete instances |
| G8 | Legacy Universal Analytics + marketplace-click tags | active | PAUSE (not delete) after §6 validation, one batch, reversible | duplicate/conflicting measurement | un-pause |
| — | Budgets/bids/targets/conversion goals | — | **No change** | preservation requirement | — |

## C. Production deployment runbook (owner-executed, coordinated)

**Phase 0 — preflight (Droid, read-only):** clean tree at `f64d30f`; vitest 118/118; matrix 25/25; artifact SHA `BCE8B2DB…`; toml prod invariants; GTM workspace evidence complete (variables, Tag-C body, 4/4 template tests).

**Phase 1 — database prerequisite:** apply migration `057_stripe_payment_idempotency.sql` to production D1 (backup-first, `--command` method; separately gated Stripe release). *Gate: checkout smoke (sandbox card) passes against a canary preview of the release branch.*

**Phase 2 — GTM workspace prep:** G1–G7 configured in GTM-KLJZZM9, unpublished. Run the 4 template tests + tag-by-tag Preview. *Gate: 4/4 + Preview firing matrix correct.*

**Phase 3 — coordinated release (one window, reversible):**
1. **Publish GTM-KLJZZM9 first.** Transitional effect on the old site: its unconditional bootstrap still loads GTM, but Consent Bridge now default-denies — pre-consent visitors generate no tag fires; Ads/Analytics tags pause for users without the corresponding consent. No double counting is possible: the old site pushes consent updates only from saved choices, and each tag fires on exactly one trigger.
2. **Deploy the website** (merge `ga4/production-release-prep` → local `master`, `npx wrangler pages deploy ./public --project-name=mildmate-new --branch=master --no-bundle`). Legacy bootstrap disappears; the consent-gated loader becomes the single path.
3. Minutes-apart execution keeps the transition dip ≤ one monitoring interval.

**Phase 4 — smoke tests:** homepage/product/cart/checkout browse with consent granted → exactly one `gtm.js` request, one GA4 pageview per page (Realtime), `view_item`/`add_to_cart`/`view_cart`/`begin_checkout` in Realtime with correct params; no staging IDs anywhere (fingerprint checks).

**Phase 5 — DebugView/Realtime verification:** DebugView on property 308922589: consent default (4×denied) before Initialization; returning-user restore before Tag B; mid-page grant refire; withdrawal stops events.

**Phase 6 — Ads verification without payments:** Google Ads conversion diagnostics ("Tag diagnostics" / `AW-18373693725` activity in GTM Preview) using the sandbox test transaction on the preview deployment — **no real purchase**. Primary `Purchase - GTM` label/value mapping read-only confirmation.

**Phase 7 — legacy tag retirement:** pause G8 batch after 48 h of clean Realtime data; un-pause if any metric regresses.

**Rollback:** website → `git revert` the merge on `master` + redeploy (restores legacy bootstrap; Consent Bridge remains harmless); GTM → version revert to pre-release version (restores unconditional tags). Both independently reversible; rollback order: GTM first if consent behavior is wrong, website first if load paths are wrong.

## D. Owner approval gate

**CONDITIONAL GO** — ready pending: (1) migration 057 production application (Phase 1), (2) GTM workspace verification evidence (Phase 2 gates), (3) your explicit approval for the Phase 3 window. No hidden automation dependencies remain.

**Exact next owner action:** confirm the Phase 1 migration window (or instruct Droid to prepare a hardening-free cherry-pick variant), then schedule the Phase 3 window.
