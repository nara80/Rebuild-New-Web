# GA4 Final Release Gate Closure — 2026-10-10

**Branch:** `ga4/remediation-isolated` · Base RC `327e667` (stripe hardening)
**Commits this round:** consent-mode + TH parity (`be22c0a`), GTM e2e harness (`09d3748`), this report (`d912bfb`). Prior round: `5505d4e`, `d0815cf`, `b19efe2`, `aaa7182`, `506a6e4`.
**Boundary honored:** no push, no merge, no production deploy, no D1 mutation, no GTM publish, no GA4 configuration changes. Release commands in §F–G are prepared, not executed.

---

## A. Consent Mode implementation proposal + outstanding owner decision

**Implemented in isolation (commit-gated, must not ship without owner sign-off):**

1. **`public/js/analytics-env.js`** — Google Consent Mode v2, Basic pattern:
   - `gtag('consent', 'default', { analytics_storage/ad_storage/ad_user_data/ad_personalization: 'denied' })` is pushed **before any Google tag executes** (GTM only loads after this push, so ordering is guaranteed; test asserts default → update → `gtm.js` order).
   - `gtag('consent', 'update', …)` reflects stored choice: `analytics_storage` granted only by Analytics consent; `ad_storage / ad_user_data / ad_personalization` granted only by Marketing consent. **Analytics acceptance never grants advertising signals** (test-asserted), and vice versa.
   - Container load gate widened to `analytics OR marketing` so Marketing-only users still get Ads conversion measurement; individual tag behavior is governed by the consent signals (Google tags have built-in consent checks).
   - `__mildmateUpdateConsent()` re-pushes state onto a loaded container — supports later opt-in and **withdrawal** (tested: withdraw → update denied in place).
2. **`public/js/cookie-consent.js`** — independent **Marketing** category (modal toggle, own description); reject = both denied; Accept All = both granted; Save reads both toggles; `mildmate_consent_update` now carries `marketing_consent` alongside `analytics_consent` (still a site-internal event — Consent Mode is implemented via the gtag consent API, not this event).
3. **Backward compatibility (returning users):** stored records without a `marketing` key parse to `marketing: false` — **historical Analytics-only acceptance is not treated as Marketing approval** (test-asserted). Returning users keep Analytics granted; Marketing stays denied.

**Outstanding owner decisions (block release of the consent commit):**
- Approve adding the **Marketing category** to the consent UI (changes what "Accept All" grants; policy text in banner/modal should be reviewed with the privacy policy — no policy file changed on this branch).
- **No silent re-prompt:** existing users with saved consent never see the banner again, so they have no UI path to grant Marketing (or to withdraw). Propose a "Cookie Settings" footer link reopening the modal as a fast-follow. Until then, Marketing consent will accrue only from new visitors using the modal.
- Withdrawal today works via the code path but is unreachable without the settings link.

## B. GTM test evidence + event matrix

**Local, real-container-free evidence (what passed):** browser matrix 14/14 (re-run after consent changes) — GTM script requested exactly once with the configured (staging) ID; `view_item` contract on product page; `purchase` pushed only for verified+reportable orders with `transaction_id` + numeric value; unverified payment → suppressed; prod IDs blocked on localhost; consent flows EN desktop / TH mobile.

**Real GTM execution (Task 3 mandate):** NOT YET VERIFIED — remaining gate. `scripts/qa-gtm-e2e.mjs` is committed and ready: it drives real page flows, records the test stream's own `/g/collect` hits (no synthetic network events), blocks all Google Ads endpoints, refuses production identifiers (`GTM-KLJZZM9`, `G-0GWVSPJLVJ`, `G-ESL161CNBV` — refusal verified by execution), and asserts per-event firing, single-fire (no duplicates), transaction params, test-stream-only targeting, zero Ads-endpoint contact, and consent-default-before-container order.

**Required to close the gate (owner must provide):** a staging/test GTM container (clone of the draft config in the 2026-10-10 readiness report §5) with a GA4 Config tag pointing at a **test** GA4 stream, then:
```
$env:GTM_TEST_ID="GTM-XXXXXX"; $env:GA4_TEST_ID="G-TESTXXXX"
node scripts/qa-gtm-e2e.mjs    # in worktree, with `npx wrangler pages dev ./public --port 8799` running
```

**Event matrix (target state after release):**

| Page(s) | Event | Source | Gate |
|---|---|---|---|
| All pages | `page_view` | GTM GA4 Config tag `G-0GWVSPJLVJ` | Analytics consent (GA4 consent check) |
| Product pages (62, EN+TH) | `view_item` | configurator → `__mildmateTrackEvent` | consent gate + GTM event tag |
| Product pages | `add_to_cart` | configurator | consent gate |
| Checkout EN+TH | `view_cart` | render-cart signature dedupe | consent gate |
| Checkout EN+TH | `begin_checkout` | session create | consent gate |
| Order-confirmed EN+TH | `purchase` | `trackPurchaseOnce` | consent gate + `payment_verified` + `purchase_reportable` + status filter + session dedupe |
| Order-confirmed | Google Ads conversion | GTM `__awct` tag | **Marketing consent** (ad_storage) via Consent Mode v2 |

## C. Remaining P0 / P1 / P2

| Severity | Item | Note |
|---|---|---|
| **P0 (blocker)** | Real-GTM e2e validation (§B gate) | Cannot report PASS without staging container + test stream |
| **P0 (blocker)** | Owner approval: Marketing consent category UI | §A decisions |
| **P0 (blocker)** | Coordinated release execution approval | §F/G runbooks ready |
| **P1** | SSR blog pages ship no analytics at all (pre-existing) | Content traffic invisible to GA4; non-transactional → schedule as follow-up release, do not expand this one |
| **P1** | No UI to re-open consent settings / withdraw (post-release follow-up) | Code path ready; needs "Cookie Settings" entry point |
| **P2** | Admin dashboards currently bootstrapped — recommend stripping analytics from `/admin/*` + `/super-admin/*` | Internal-only surfaces; pollutes GA4 if kept |
| **P2** | Quote page (`/quote/QT-…/`) pushes `view_quote`/`add_to_cart` that nothing consumes (pre-existing dead code) | Not business-critical: no GTM tag consumes these events today and no data is lost vs. the current production state; either bootstrap the page later or delete the pushes |
| **P2** | Pre-existing mojibake in `public/deep-pocket/index.html`, `public/products/index.html` | Present at RC; unrelated to GA4 |
| **P2** | GA4 Data API auth for property `308922589` unverified from this environment | Verify at marketing-sync release step |

## D. Final test results + commits

| Suite | Result |
|---|---|
| vitest (4 files: stripe hardening, email safety, analytics isolation, dataLayer/consent contract) | **54/54 passing** |
| Browser matrix (`scripts/qa-browser-matrix.mjs`, re-run post-consent) | **14/14 passing** |
| Encoding scan (146 files) | Clean except 2 pre-existing files (P2) |
| `node --check` on all modified JS | OK |
| Legacy ID grep at final state (`G-ESL161CNBV`, direct `gtag/js` loads) | **0 matches** in `public/` + `templates/` |
| GTM e2e harness self-test | Gates on missing staging access (exit 2); refuses production IDs (verified) |

Commit chain (this round): consent-mode + TH parity → GTM e2e harness → this report.

## E. Production D1 migration 057 — backup-first procedure

`057_stripe_payment_idempotency.sql` creates `stripe_webhook_events` + `stripe_order_fulfillment_lines` (idempotent fulfillment guards). Additive only (CREATE TABLE/INDEX IF NOT EXISTS); no ALTER of existing tables.

```powershell
# 0. Prereq: from repo root, authenticated wrangler. KNOWN ISSUE: --remote --file fails with
#    auth code 10000 on this account — use --command (AGENTS.md, Phase 17 note).

# 1. BACKUP (export affected tables first; both are new, so this is a point-in-time snapshot)
npx wrangler d1 execute mildmate-db-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('stripe_webhook_events','stripe_order_fulfillment_lines');"
# Record row counts (expect 0 rows / 'no such table' pre-migration):
npx wrangler d1 execute mildmate-db-prod --remote --command "SELECT COUNT(*) FROM stripe_webhook_events;" 2>$null
# Full-DB snapshot for the release window (single statement via --command):
npx wrangler d1 execute mildmate-db-prod --remote --command "SELECT sql FROM sqlite_master;" > d1_schema_backup_057.sql

# 2. APPLY (atomic; IF NOT EXISTS = re-runnable)
npx wrangler d1 execute mildmate-db-prod --remote --command (Get-Content -Raw migrations/057_stripe_payment_idempotency.sql)

# 3. VERIFY
npx wrangler d1 execute mildmate-db-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'stripe%';"
```

Rollback: `DROP TABLE` of the two new tables (safe only while webhook traffic is paused — see §H). **Ordering rule: 057 precedes any Stripe-hardening deployment** (hardened webhook writes `stripe_webhook_events`; deploying code before the tables exist would fail fulfillment writes).

## F. Coordinated website + GTM release runbook (prepared, NOT executed)

Ordering: **057 (E) → GTM publish → website deploy → verification.** GTM first so the container's canonical Config tag is live when the site's inline legacy loader disappears (prevents a page_view gap window). During the window between website deploy and GTM publish, page_view via GTM continues from the existing v16 Config tag — no data loss either direction.

1. **GTM** (manual, UI): open container `GTM-KLJZZM9` → apply the §5 draft of the 2026-10-10 readiness report (keep `__googtag` G-0GWVSPJLVJ All Pages; add generic GA4 Event tag `{{Event}}` on regex `^(view_item|add_to_cart|view_cart|begin_checkout|purchase)$` with ecommerce from data layer; verify `__awct` purchase DLVs read `eventModel.*`; no Consent Initialization tag needed — site pushes consent default pre-load) → Preview against staging → **Submit + Publish** as a new version with notes.
2. **Website:**
```powershell
git checkout master; git merge --no-ff ga4/remediation-isolated   # after owner merge approval
npx wrangler pages deploy ./public --project-name=mildmate-new --commit-dirty=true --branch=master --no-bundle
```
   (`--no-bundle` is mandatory per AGENTS.md — the committed `_worker.js` is the runtime artifact; no function edits on this branch.)
3. **48–72h verification:** GA4 DebugView/Realtime (`view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `purchase` on a REAL transaction only — no synthetic tests against production); `sync_runs`/`ga4_funnel_daily` gains `308922589` rows; Ads conversions fire only where Marketing consent was granted.

## G. Independent marketing-sync release procedure

Fully independent of §F (own worker, own config) — can be deployed before or after, but collector rows for `308922589` only become meaningful once the website release has produced traffic:
```powershell
cd marketing-sync-worker
npx wrangler deploy          # ships wrangler.toml GA4_PROPERTIES_JSON website property 308922589 (Etsy 533944293 untouched)
# Trigger a manual pass and inspect:
# https://mildmate-marketing-sync.nara19080.workers.dev/run  (POST, per Phase 17 ops)
# Verify in D1: sync_runs success + ga4_funnel_daily rows with property_id 308922589
```
Also verify GA4 Data API auth for property `308922589` on this run (P2). Historical rows for legacy property `366290587` remain queryable; no migration accompanies this release.

## H. Rollback plan

| Component | Rollback | Restores |
|---|---|---|
| Website | `npx wrangler pages deploy` of the previous good build (or Cloudflare Pages dashboard → previous deployment → Restore) | Previous inline legacy bootstrap; site/GTM config returns to pre-release state |
| GTM | GTM UI → Versions → **republish previous container version** | Prior tag configuration |
| marketing-sync | Restore env var `GA4_PROPERTIES_JSON` with `366290587` and redeploy | Prior collector target (historical D1 rows unaffected) |
| D1 057 | `DROP TABLE stripe_webhook_events; DROP TABLE stripe_order_fulfillment_lines;` — **only** with webhook processing paused, and only if the hardened webhook code is also rolled back | Pre-migration schema |

Rollback consistency rule: website and GTM rollbacks should happen as a pair (the whole point of the coordinated release); marketing-sync rolls back independently. Every rollback target is a prior versioned artifact — no destructive operations.

## I. Final verdict

**NO-GO for production today** — three blockers, all external, none code defects:

1. **Real-GTM e2e validation** (§B): staging GTM container + test GA4 stream not yet provided; harness ready and self-tested. Per mandate this is reported as a REMAINING GATE, not a PASS.
2. **Owner approval of the Marketing consent category** and the §A follow-on decisions (settings re-open UI, banner/policy wording).
3. **Release execution approval** (runbooks §F/G ready; commands prepared, not run).

Once 1–3 are satisfied, this branch is GO for the coordinated release sequence. All QA code changes are isolated on `ga4/remediation-isolated`; production is untouched.
