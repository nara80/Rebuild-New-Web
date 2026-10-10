# MildMate — Google Ads Purchase Conversion & Stripe Checkout Hardening
## Reconciled cross-project handoff | Marketing Decision System Architect

**Status as of:** 2026-10-10 (Asia/Bangkok), after genuine Stripe Sandbox Checkout and Droid post-payment reconciliation  
**Source:** Reconciles `MildMate_GoogleAds_Stripe_Conversion_Hardening_Handoff_2026-10-10(2).md` against the subsequent operator screenshots/PowerShell outputs and Droid engineering reports in this conversation.  
**Intended receiver:** MildMate Marketing Decision System Architect / analytics and Google Ads integration team  
**Scope:** Paid-order measurement integrity, Stripe → Cloudflare/D1 → order confirmation → GTM/Google Ads, release dependencies, marketing data freshness, next actions.

> **CURRENT DECISION — `STAGING_E2E_PASS / ADS_CONFIGURATION_GO / PRODUCTION_RELEASE_NO_GO`.**  
> The genuine Stripe Sandbox checkout and order-reporting checks succeeded in staging. The hardening code was committed and pushed to a nonproduction branch. **Production D1 still lacks migration 057's two tables; the hardening code has not been released to `master`/production.** Google Ads configuration work can resume **now**, but production conversion tracking cannot yet be called verified.

### Evidence and interpretation conventions

- **Operator-confirmed:** directly visible in supplied Stripe/Cloudflare screenshots or PowerShell/CLI output.
- **Droid-reported:** results of the engineering agent's code, D1, API, Git, or environment checks; distinguish from independent external confirmation.
- **Code/config/test PASS:** implementation and automated tests pass; does not necessarily prove all live external side effects.
- **Not independently verified:** requires a direct authoritative read, receiving-system telemetry, or production run.
- **No secrets:** this handoff includes no Stripe API keys, webhook signing secret values, card CVC, personal shipping address, or complete Stripe Checkout Session identifiers. Test records only were used for the staging payment.

---

## 1. Executive summary: what changed since the original handoff

The initial investigation arose from a MildMate US/Canada Google Search campaign with observed spend and clicks but **inactive/misconfigured purchase-conversion measurement**. Engineering found deficiencies around Stripe payment confirmation, webhook/order deduplication, historical fulfillment state, and environment-specific GTM/GA4 loading. An early audit also found that Cloudflare Preview could send real Resend emails. **Those staging email risks were fixed in code and tested**, and a clean isolated release candidate was deployed successfully.

**The former document's headline `STAGING_NO_GO`, “end-to-end validation not complete,” “email kill switch not implemented,” and `2ad5eb23` current webhook URL are superseded.** Do not carry those old status claims into the Marketing Decision System.

**Now achieved:**

1. Stripe payment/purchase-reportability and webhook idempotency hardening committed on **`origin/rc/stripe-preview`**, commit **`327e667bc64bbac42f695813fde66341603b6e7a`** (Droid-reported Git result); not merged to `master`.
2. Central, fail-closed nonproduction email guard implemented, contradictory environment flags handled; **40/40 tests passed** in isolated RC (Droid-reported).
3. Deterministic Worker bundle built twice with identical SHA-256; deployed from isolated RC worktree to **`https://a27d9e4c.mildmate-new.pages.dev`** (operator PowerShell deployment output).
4. Stripe Sandbox's **active** `MildMate-Stripe-Staging-Hardening` destination points to the **`a27d9e4c`** Preview webhook. Obsolete `MildMate-Sanbox` destination is **disabled**.
5. Unsigned POST returned `HTTP 400 {"error":"Missing signature"}`; signed CLI `checkout.session.completed` webhook returned **200 OK** and was recorded without an order; this was an intentionally synthetic fixture.
6. **One genuine browser Checkout with Stripe test card** completed and redirected to staging order confirmation. Droid reported **one paid/reportable order, one processed event, one fulfillment line**, THB 1,590, with no duplicate order rows observed.
7. Production `stripe_webhook_events` / `stripe_order_fulfillment_lines` tables are still **missing**, so **production cutover remains blocked**; Google Ads/GTM configuration and diagnostics may proceed in parallel.

**Critical marketing instruction:** Treat ads spend, verified Stripe payments, order-line fulfillment, browser purchase-event emission, and Google Ads-attributed conversions as separate facts. The staging E2E success **is not evidence that Google Ads has recorded a production purchase conversion**, and it does not fix the separate Google Ads API collector 403/zero-row problem.

---

## 2. Current system inventory and authoritative references

| Component | Current reference | Provenance / caution |
|---|---|---|
| Live website | `https://www.mildmate.com/` | Production; not changed by these Preview-only test steps |
| Cloudflare Pages | `mildmate-new` | Production Git branch reported as `master` |
| Original development folder | `D:\00_mildmate\re-build_web` | Dirty; **do not deploy from here for this release** |
| Isolated RC worktree | `D:\00_mildmate\re-build_web_rc` | Approved deterministic build location |
| RC source branch | `rc/stripe-preview` / `origin/rc/stripe-preview` | Pushed commit `327e667bc64bbac42f695813fde66341603b6e7a` |
| Cloudflare Preview deployment | `https://a27d9e4c.mildmate-new.pages.dev` | **Tested RC release**; distinct from Git commit metadata |
| Preview branch alias | `https://hardening-stripe-purchase-id.mildmate-new.pages.dev` | Mutable alias; prefer immutable URL for test evidence |
| Stripe active Sandbox webhook | `MildMate-Stripe-Staging-Hardening` | `https://a27d9e4c.mildmate-new.pages.dev/api/webhook/stripe` |
| Legacy Sandbox webhook | `MildMate-Sanbox` | **Disabled**; formerly `note-test-preview...` |
| Preview D1 | `mildmate-db`, UUID `85ce2f41-463a-43fa-8485-181e983b8fd4` | Actual read-only queries used `--remote --env preview` and resolved this UUID |
| Production D1 | `mildmate-db-prod`, UUID `854f206a-b240-491c-bb91-7e064736d487` | Migration 057 tables missing as of last read-only audit |
| Shared R2 bucket | `mildmate-assets` | Shared Preview/production binding; audited Checkout/webhook paths do not write R2; admin-upload risk remains outside tested scope |
| Google Tag Manager | `GTM-KLJZZM9` | `CE - purchase`, `Purchase - GTM` action configuration |
| Google Ads base tag | `AW-18373693725` | Homepage Tag Assistant found base tag/Conversion Linker |
| Google Ads purchase actions | `Purchase - GTM` **Primary**, `Purchase` **Secondary** | Both previously marked **Inactive**; **current Ads status must be rechecked** |
| Stripe CLI | `npx --yes @stripe/cli`, version `1.53.1` | Operator confirmed authorized for MildMate **sandbox** account |
| Stripe Sandbox destination payload | Snapshot, API `2022-11-15` | Subscribed to 3 Checkout session events |

**Webhook subscriptions:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. Test secret key and destination-specific `whsec_` are configured by name in Cloudflare Preview; values are never reproduced here.

**Release provenance nuance:** Pages deployment `a27d9e4c` was deployed **before** the later Git commit `327e667...`; do **not** claim Cloudflare deployment metadata is at that Git SHA. Release integrity is supported by the operator's predeployment RC bundle hash check and the deploy command running from the RC directory. The Pages artifact itself was not downloaded for a remote byte-for-byte SHA check.

---

## 3. Original Google Ads problem — preserve as historical evidence, not current status

- US/Canada Search campaign for sofa/couch cushion-protector terms, **Maximize Clicks**, average daily budget **THB 180**.
- Oct 8 snapshot: **212 impressions, 6 clicks, 2.83% CTR, THB 360 spend, THB 60 average CPC, zero reported conversions**. These are *dated observations*, not present-day cumulative metrics.
- Google Ads can spend up to approximately 2× an average daily budget on some days, subject to billing limits; THB 360 in one day is not sufficient to infer a billing defect.
- An initial **~THB 50 maximum CPC cap** was discussed as a possible experiment, **not established as an optimal bid**.
- Google Ads goals showed `Purchase - GTM` as Primary and `Purchase` as Secondary; both were **Inactive / Unverified** during diagnosis. The user intentionally set these respective priorities.
- Tag Assistant homepage check: `GTM-KLJZZM9`, base Google/Ads tag, and Conversion Linker were present/fired; `Purchase - GTM` did **not** fire on the homepage, which is expected without a purchase event. This **did not itself prove a purchase trigger failure**.
- GTM `Purchase - GTM` tag: **Google Ads Conversion Tracking**, `CE - purchase` custom-event trigger (`_event = purchase`). Data Layer Version 2 variables: `DLV - Value` → `eventModel.value`, `DLV - Transaction ID` → `eventModel.transaction_id`, `DLV - Currency` → `eventModel.currency`.
- **Separate problem:** Google Ads marketing collector previously returned `403 PERMISSION_DENIED`; analysis tables had **zero ingested Google Ads rows** at that earlier audit. The Stripe hardening release **does not repair Google Ads API authorization, source backfill, or freshness**. A failed ingestion is *missing data*, not zero advertising spend.

**Measurement rule:** Zero Ads conversions during broken/unverified tagging does **not** prove zero sales. Stripe payment evidence does **not** prove Ads-attributed conversion. Do not publish trusted CPA/ROAS or automate bidding decisions until the appropriate source and conversion state have been separately verified.

---

## 4. Technical defects discovered and fixes now included in RC

### 4.1 Paid status must be authoritative

- **Prior defect:** `workers/api/order-confirmed.ts` previously accepted `payment_status='paid' OR status='complete'`; Checkout completion alone does not establish payment.
- **New contract:** Valid purchase requires verified paid Stripe Session or acceptable validated paid-webhook evidence; D1 row presence or payment-intent ID alone is insufficient. `/api/order-confirmed` exposes `payment_verified`, `purchase_reportable`, `purchase_reportable_value`.
- **Browser rule:** Only emit a purchase when **both** `payment_verified === true` and `purchase_reportable === true`.

### 4.2 Webhook + logical fulfillment idempotency

- **Prior defect:** Replayed `checkout.session.completed` events could insert duplicate order rows.
- **Migration 057:** `stripe_webhook_events` (`event_id` primary key; processing ledger) and `stripe_order_fulfillment_lines` (`line_key` primary key; logical per-session fulfillment-line dedupe), with indexes.
- **Design:** Multiple legitimate order lines for one Stripe Session are allowed; do **not** impose a simplistic unique constraint on `orders.stripe_session_id`. Retry/concurrency/reordered lines/historical order states were covered in local tests.
- **Evidence boundary:** Live staging first synthetic event and one genuine paid event were each recorded; **a duplicate replay after the paid event was not performed**. Thus the live test shows *no duplicates for one delivery*, while replay protection relies primarily on local tests and implemented constraints.

### 4.3 Historical status versus reportable sale

- Production preflight showed historical `shipped`/`cancelled` rows and potential duplicates; implementation handles historical states for deduplication/recovery: `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded` as appropriate.
- **Reportable states** for new purchase value: `confirmed`, `processing`, `shipped`, `delivered`. Cancelled/refunded lines do not contribute to *new* reportable purchase value.
- Historical cancellation/refund **Google Ads conversion adjustments are not yet implemented/verified**. Do not equate current refunded state with a complete conversion retraction workflow.

### 4.4 Preview analytics/Stripe/database isolation

- `functions/_middleware.ts`, `public/js/analytics-env.js`, Checkout HTML, and confirmation HTML now use runtime analytics environment configuration. **Preview disabled by default**; only isolated nonproduction IDs may be explicitly approved, not production tracking IDs.
- Preview runtime page marker directly observed: `window.__MILDMATE_ANALYTICS_CONFIG = {"environment":"staging","nonProductionApproved":false}`.
- Server-side Stripe guards use Preview test environment and D1 labels. Admin R2 uploads are beyond current checkout-test scope; shared bucket warrants ongoing caution.

### 4.5 Nonproduction outbound email hardening — **resolved in code/tests**

- **Early blocker:** Resend credentials exist in Preview; webhook, scheduled abandoned-cart/thank-you sends, and admin dispatch could send real emails.
- **Implemented later:** Shared `evaluateOutboundEmailSafety(env)` / guarded `sendEmail(...)` in `workers/api/email.ts` routes email-sending app paths through a fail-closed nonproduction policy. Includes webhook notifications, `functions/cron.ts`, `workers/api/admin-thankyou-dispatch.ts`, `workers/api/admin-recovery-test.ts`, other `sendEmail` callers.
- Preview flag `NON_PROD_EMAIL_ALLOWED="false"`; contradictory signals (e.g. staging/staging/live) are blocked; production-preservation scenarios tested.
- Suppressed sends return `success:false` with `EMAIL_SUPPRESSED` diagnostic; tests ensure admin thank-you queue isn't marked sent on suppression.
- **Evidence:** 11 email safety tests within 40/40 suite; staging test thank-you queue remained `sent=0` per Droid. **Direct Resend provider delivery logs were not examined**, so “no email delivered” is supported by code/config/queue evidence, not independent provider telemetry.

### 4.6 Nonblocking frontend product display/wording issues

- Stripe Checkout line-item description displayed `undefined×undefined undefined` for fixed-size BedBridge item because `workers/api/checkout.ts` interpolates absent dimensions.
- Staging confirmation page showed a partial `cm` label when width/length/depth fields were null because `public/order-confirmed/index.html` appends the unit even if no dimensions exist.
- Minimal future correction: numeric W×L(×D) only where provided; otherwise use a valid fixed-size/`size_text` label or omit dimension text. No fix had been deployed at handoff.
- Staging confirmation page said an email was sent, while its email guard suppresses actual sending; adjust UI copy in a later small change. No reason to repeat payment solely for these copy/formatting issues.

---

## 5. Release engineering, Git, and safe build provenance

### 5.1 Isolation error discovered and corrected

1. The original development workspace `D:\00_mildmate\re-build_web` was dirty with unrelated marketing-sync, GA4, quote/CSP, handoffs, other migrations/assets.
2. Droid prepared isolated `D:\00_mildmate\re-build_web_rc` with **18 explicitly approved source/config/test file changes** and generated Worker bundle. At one stage the operator accidentally deployed the dirty original workspace, producing `6b72e744`; that release was **not accepted for strict artifact provenance**.
3. Root cause: `extract-worker.ps1` hardcoded `cd D:\00_mildmate\Re-Build_web`, allowing a purported RC build to use original workspace sources. The RC-only script was fixed to use `$PSScriptRoot`, assert the RC root, use RC-relative temp/output locations, and normalize a temporary route-comment nondeterminism.
4. Droid reported **40/40** local tests (24 Stripe purchase, 11 email safety, 5 analytics isolation), successful `node --check public\_worker.js`, and two reproducible builds.
5. RC Worker SHA-256 from **both** builds: `2173DF68AE551ED36BD26EEE3F81DC6D170DFC4F1DC0B86706A0AC2357596905`. Operator's PowerShell **checked this exact hash** before executing the successful RC Preview deploy.
6. Operator deployed from `D:\00_mildmate\re-build_web_rc` using `npx wrangler pages deploy .\public --project-name=mildmate-new --branch=hardening/stripe-purchase-idempotency --commit-dirty=true --no-bundle`; output: deployment successful, **`a27d9e4c`**.
7. Operator's HTTP page checks on `a27d9e4c` returned all five expected values: `payment_verified`, `purchase_reportable`, `purchase_reportable_value` markers, `environment="staging"`, and `nonProductionApproved=false`.
8. **After** deployment, Droid committed approved RC work to **`327e667bc64bbac42f695813fde66341603b6e7a`** and pushed **`origin/rc/stripe-preview`**; production branch `master` was not merged/pushed. RC Git status clean except untracked generated `worker-configuration.d.ts` (reported; exclude as appropriate).

**Important:** The *pushed* Git branch `rc/stripe-preview` is not the same name as the *Cloudflare Preview deployment target branch* `hardening/stripe-purchase-idempotency`. Preserve this distinction in cross-project coordination.

### 5.2 Current verified deployment

- **Use:** `https://a27d9e4c.mildmate-new.pages.dev` (immutable Preview URL).
- **Webhook:** `https://a27d9e4c.mildmate-new.pages.dev/api/webhook/stripe`.
- **Do not use for present testing:** prior `2ad5eb23` or untrusted `6b72e744` deployment as though they were the accepted RC; `note-test-preview` was an older endpoint, with its destination disabled.
- **Production:** `www.mildmate.com` remains outside this hardening rollout, pending migration + release approval.

---

## 6. Stripe Sandbox tests — chronological reconciliation

### 6.1 Signed webhook security/delivery

- `curl.exe -i` unsigned POST to Preview `/api/webhook/stripe` returned **HTTP 400** and body `{"error":"Missing signature"}` (operator-confirmed).
- Stripe CLI `npx --yes @stripe/cli version` returned **`stripe version 1.53.1`**; browser device authorization reported **MildMate · sandbox** account (operator-confirmed).
- CLI-generated synthetic `checkout.session.completed` sent through configured Dashboard destination; Stripe showed **Delivered / HTTP 200** and response `{"received":true,"inserted_order_rows":0}` (screenshots).
- Staging D1 saved one event with `processed_at` populated, `process_result='deduped_no_new_rows'`, `last_error=NULL` (operator SQL); **no order or fulfillment lines** were added. This first delivery is **not** a duplicate replay proof, despite its result name.

### 6.2 Genuine browser paid Sandbox Checkout — accepted

**Operator-confirmed browser path**: staging BedBridge Connector × 1 → staging shipping form → Stripe-hosted Checkout **Sandbox** with official test Visa → redirected to staging `/order-confirmed/?session_id=cs_test_...` → **Order Confirmed** page with **THB 1,590**. No real card/payment was used.

**Droid post-check** (read-only, one session):

| Verification | Outcome | Evidence strength |
|---|---|---|
| Webhook event | `checkout.session.completed`; result `processed` | Droid D1 audit |
| Session-linked `orders` | **1** BedBridge line, `qty=1`, `status=confirmed` | Droid D1 audit |
| Session-linked `stripe_webhook_events` | **1** | Droid D1 audit |
| Session-linked `stripe_order_fulfillment_lines` | **1** | Droid D1 audit |
| `payment_verified` | **true** | Droid `/api/order-confirmed` read |
| `purchase_reportable` | **true** | Droid `/api/order-confirmed` read |
| `purchase_reportable_value` | **1590** | Droid `/api/order-confirmed` read |
| Stored paid-order currency | **`thb`** | Droid D1 audit |
| Stored order amount | **`price_thb=1590`** | Droid D1 audit |
| Purchase `transaction_id` | Stripe Checkout Session ID (`cs_test_...`) | Builder source contract + session linkage; browser event itself suppressed in staging |
| Emails not marked sent | Thank-you queue `sent=0`; Preview email guard active | Droid code/config/queue; no independent Resend delivery-log check |
| Production analytics disabled | `nonProductionApproved=false` + JS guard | Staging page/config; no independent outbound network or Google Ads ingestion trace |

**Staging D1 row counts:**

| Stage | `orders` | `stripe_webhook_events` | `stripe_order_fulfillment_lines` | Orders for test email |
|---|---:|---:|---:|---:|
| Before any webhook tests | 2 | 0 | 0 | 0 |
| After synthetic signed fixture | 2 | 1 | 0 | 0 |
| After genuine Sandbox paid Checkout | **3** | **2** | **1** | **1** |

The final test produced exactly **+1 order, +1 processed webhook event, +1 fulfillment line** relative to the immediately preceding baseline. No duplicate records were observed for that payment/session. These are **staging records**, not new live commercial revenue.

### 6.3 Currency and Checkout Session authority — reconciled

- MildMate storefront showed **USD $45.00**; Stripe Sandbox Checkout showed **THB ฿1,590**, and order confirmation/D1 showed **THB ฿1,590**. Droid considers this the site's intentional geographic/local-currency pricing behavior, but the cross-currency pricing policy and FX rationale were **not independently audited**.
- **For this transaction, downstream conversion payload must use the actual paid/reportable THB amount/currency**, not the USD storefront display: `value=1590`, `currency='THB'`, with `transaction_id=Stripe Checkout Session ID`.
- Direct authoritative Stripe Sandbox confirmation is now complete (operator-authenticated read in account `acct_1MrPYPIgiNtHfBe3`) for session `cs_test_a18Rhqecpzk6ZNkrJnGCbEqBPTB5C7BGcJV8f6FGVfQZLrLTVliBUKZij4`:
  - `payment_status=paid`
  - `status=complete`
  - `currency=thb`
  - `amount_total=159000`
  - `livemode=false`
- Webhook signature match with active destination is strongly supported by successful signed 200 delivery and recorded event; this does not prove all production Stripe runtime settings.

**Staging outcome: `E2E_PASS_WITH_EVIDENCE_NOTES`.** There is **no need to repeat the test payment** to resolve the remaining evidence gaps.

---

## 7. Database schema, production migration 057, and historical data hazards

### 7.1 Production D1 preflight (historic audit)

| Metric | Droid-reported count | Warning |
|---|---:|---|
| Existing order-line rows | 24 | Not 24 independent purchases |
| Distinct Stripe sessions | 12 | Not necessarily 12 paid/Ads-attributed conversions |
| Shipped rows | 13 | Fulfillment state, not conversion attribution |
| Cancelled rows | 11 | Do not count as current reportable value |
| Sessions containing multiple rows | 3 | Multiple valid items possible |
| Potential duplicate line groups | 2 | Potential, not proven; do not delete automatically |
| Sessions with mixed statuses | 1 | Compute at line level |
| Entirely cancelled sessions | 4 | Do not count as current reportable purchase value |

### 7.2 Migration 057 is missing in production — **release blocker**

- Production D1 UUID `854f206a-b240-491c-bb91-7e064736d487` lacks **`stripe_webhook_events`** and **`stripe_order_fulfillment_lines`** tables (Droid's read-only production schema query). The approved hardening runtime requires them.
- Staging D1 UUID `85ce2f41-463a-43fa-8485-181e983b8fd4` has both tables from manual application of `migrations/057_stripe_payment_idempotency.sql` and has now recorded the synthetic + real Sandbox test entries.
- **Migration registry hazard:** Earlier staging `d1_migrations` bookkeeping did not reflect already-existing schema; 59 migrations appeared pending, and an attempted bulk apply failed at a duplicate `tags` column. Never run the full pending queue blindly, and never fabricate migration-history rows.
- Required separately approved production procedure: **read-only schema inspection → validated backup/recovery plan → review migration 057 DDL against actual production schema → narrowly apply only the necessary approved SQL → verify tables, keys, indexes, no unexpected changes → deploy compatible production code only after migration readiness**. Preserve a record of what was actually applied, because raw `d1 execute --file` may not update migration bookkeeping.
- The production schema check is **already completed**; production write/application is **not approved or performed**. No production D1 mutation should be assumed from this handoff.

### 7.3 Rollout dependencies

Production release must coordinate the database and the code. Do not expose production traffic to a Worker that requires unavailable tables. A reversible/recoverable deployment plan and explicit operator sign-off are required; D1 data rollback is not equivalent to merely redeploying an older Pages artifact.

---

## 8. Purchase conversion contract for the Marketing Decision System

**Current implemented/staging-tested core contract:**

| Field/decision | Definition and constraint |
|---|---|
| Authoritative payment | Verified paid Stripe Checkout Session or validated equivalent paid-webhook evidence; **not** `status='complete'` alone |
| `payment_verified` | Must be strictly `true` before event can be reportable |
| `purchase_reportable` | Must be strictly `true`, with at least one reportable paid order line |
| Reportable fulfillment states | `confirmed`, `processing`, `shipped`, `delivered` (cancelled/refunded excluded from new reportable value) |
| `transaction_id` | Stable Stripe Checkout Session ID; should dedupe browser purchase conversions across revisit/retry |
| `value` | `purchase_reportable_value` (for observed staging payment **1590**) |
| `currency` | Actual verified order/payment currency (for observed staging payment **THB**) |
| Browser event | `gtag('event','purchase', {transaction_id, currency, value, items, ...})` gated by both flags |
| GTM mapping | `CE - purchase` → `Purchase - GTM`; `eventModel.transaction_id`, `.currency`, `.value` |
| Google Ads primary action | `Purchase - GTM` **Primary**; legacy `Purchase` **Secondary** until deliberate consolidation |
| Staging analytics | **Disabled** by default; no test conversion should be reported as production Google Ads revenue |
| Validated scope | Stripe → staging order D1 and API flags; **not yet live production Ads attribution** |

**Data model boundaries recommended for receiving architect (proposed, not assumed implemented):**

1. `ads_spend_daily`: Ads reporting date/timezone, campaign/clicks/spend/currency, collector authentication + freshness. API 403/zero rows = **unknown/missing**, never zero spend.
2. `stripe_payment_verified`: session/payment evidence, amount/currency and authoritative Stripe lifecycle independently of Google Ads.
3. `order_line_fulfillment`: deduplicated line keys, quantity, status; aggregate without mistaking row count for purchase count.
4. `purchase_event_emitted`: browser event with stable transaction ID, release/environment, consent state, and client diagnostics. **Emitted ≠ Ads ingested**.
5. `google_ads_attributed_conversion`: Google Ads reported action/campaign/attribution date/received value and data freshness; separate from all paid sales.
6. `conversion_adjustment` (future): refund/cancellation adjustment/retraction behavior explicitly designed; no automatic rewriting of historical credited sales from current order status alone.

**Measurement quality gates:** Preserve THB/USD separately or use documented dated FX conversions; track environment and release hashes; distinguish Stripe event time, order time, and Ads attribution date; suppress automated CPA/ROAS-based bidding and marketing recommendations when purchase tracking is not production verified or Ads API freshness fails. Do not infer Ads conversions from Stripe orders or Stripe payments from Ads purchases.

---

## 9. What is DONE, what remains OPEN, and release gates

| Workstream | Current status | Next owner/action |
|---|---|---|
| Stripe payment hardening | **Implemented, 40 local tests; staging E2E passed** | Website engineering maintains contract |
| Staging email guard | **Implemented/tested** | Optional provider-log confirmation; no need to repeat payment |
| Deterministic isolated RC build | **DONE** | Retain release manifest and hash |
| Git commit/push | **DONE** on `origin/rc/stripe-preview` | No merge to `master` yet |
| Signed Stripe Sandbox webhook | **PASS** | No more synthetic fixture tests necessary |
| Genuine paid Sandbox Checkout | **PASS**, one product/one order | No second payment needed |
| Direct Stripe Session four-field read | **PASS** (`paid`, `complete`, `thb`, `159000`, `livemode=false`) | Closed — no further test payment required |
| Production migration 057 | **BLOCKED / not applied** | DBA/operator backup-first narrowly reviewed production-only release |
| Production hardening deploy | **NO-GO** pending schema and sign-off | Website engineering/release owner |
| Google Ads `Purchase - GTM` | **Configuration work GO; live verification OPEN** | Ads/GTM owner check current action/tag state |
| Google Ads API 403/ingestion | **Separate unresolved issue** | Marketing data engineering fix OAuth/developer access and backfill |
| Production CPA/ROAS automations | **NO-GO** until verified measurements | Marketing Decision System Architect |
| Fixed-size dimension labels / email copy | **Nonblocking backlog** | Website UX follow-up |

### Release gates that matter now

- **Gate A — Production D1 migration 057:** explicit approval, backup/recovery plan, apply/verify only required migration 057 schema without bulk backlog replay.
- **Gate B — Production release:** deploy approved code to `master` only after compatible DB ready; verify production Stripe/analytics settings and protect historical orders.
- **Gate C — Production purchase measurement:** after safe live deployment, verify GTM event data and Google Ads conversion action health using **legitimate, consent-compliant paid event evidence**; do not fabricate conversions or run a real transaction without explicit approval.

**Not blockers to resume Ads *configuration*:** completion of Gates A–D. They **are** blockers to calling production purchase measurement reliable or enabling automated conversion-based decisions.

---

## 10. Immediate handoff instruction to receiving Marketing Decision System Architect

**Proceed now with Google Ads conversion setup and diagnostics, in parallel with website production release preparation.** Do not restart the Stripe hardening investigation or request additional Sandbox payments.

**Suggested short workplan:**

1. Reopen **Google Ads → Goals → Conversions → Summary**; record the *current* `Purchase - GTM` (Primary) and `Purchase` (Secondary) statuses; the former Inactive screenshots are historical.
2. Verify GTM `CE - purchase` trigger, Purchase - GTM action mapping, Ads conversion ID/label, transaction ID, paid value and currency. Do **not** assume live firing from staging, because production analytics are intentionally suppressed there.
3. Verify consent-aware diagnostic path and production release readiness before asserting conversion health. A homepage-only Tag Assistant check cannot validate the purchase trigger.
4. Independently resolve **Google Ads API collector 403**, establish authorized backfill and source-to-D1 reconciliation; label absent rows as `api_permission_error` or `data_unavailable`, not zero spend.
5. Keep marketing measurement quality status explicit: `staging_e2e_verified`, `production_conversion_unverified`, `ads_api_permission_error` (if still present), `migration_057_pending`. Re-evaluate when new direct evidence appears.
6. Do not automate ROAS/CPA-driven bidding/budget decisions from unverified conversions. Coordinate production migration/release with website engineering, without blocking unrelated Ads setup.

**One-line brief to paste into the other project:**

> MildMate Stripe purchase hardening is **committed/pushed** (`origin/rc/stripe-preview`, `327e667...`) and **genuine Stripe Sandbox Checkout E2E passed** on Cloudflare Preview `a27d9e4c`: one THB 1,590 BedBridge paid/reportable order, one processed signed webhook, one fulfillment line, `payment_verified=true`, `purchase_reportable=true`. Stripe authoritative fields are confirmed for the tested session (`payment_status=paid`, `status=complete`, `currency=thb`, `amount_total=159000`, `livemode=false`). **Resume Google Ads conversion configuration now**; retain `Purchase - GTM` Primary and `Purchase` Secondary. **Remaining production release gate:** backup-first migration 057 (two tables still missing in prod D1), then safe release and production GTM/Ads validation. Google Ads API collector 403 is an independent unresolved measurement issue; do not use unverified Ads conversions or missing Ads rows to calculate trusted ROAS.

---

## 11. Reconciliation notes: explicitly superseded older claims

| Older attached-file claim | Reconciled current state |
|---|---|
| “Local fixes mostly prepared; staging end-to-end not complete” | **FALSE as current status:** staging signed webhook + genuine paid Sandbox Checkout completed and reconciled |
| “Staging emails can still be sent / kill switch not implemented” | **Superseded:** centralized guard implemented, contradictory environment tests passed; 40/40 local tests; provider logs not independently checked |
| “28/28 tests” | Superseded by **40/40** RC tests |
| “Current webhook URL `2ad5eb23`” | Superseded by **`a27d9e4c`** verified deployment; old destination disabled |
| “Signed webhook secret linkage unverified” | Supported by signed Stripe event delivering HTTP 200 and recorded staging event |
| “Staging 057 tables initially empty” | Schema exists; current counts **2 webhook events, 1 fulfillment line** after tests |
| “No real Checkout test performed” | **Genuine Stripe Sandbox test-card Checkout completed; no real-money charge** |
| “Changes uncommitted in dirty workspace” | RC isolated, reproducibly built; **commit `327e667...` pushed** on `rc/stripe-preview`; production unmerged |
| “Production ready” | **Still false:** migration 057 is missing; production tag verification still pending |
| “Zero Ads conversions / Google Ads collector rows” | Historical diagnosis only, not current verified live metrics; collector 403 remains independently unresolved |

**Final cross-project decision: `ADS_SETUP_GO / STAGING_E2E_PASS / PRODUCTION_SCHEMA_PENDING / PRODUCTION_CONVERSION_UNVERIFIED`.**
