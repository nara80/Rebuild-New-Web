# MildMate — Google Ads to GA4 Paid Search Attribution Audit

**Date:** 2026-10-20  
**Mode:** READ-ONLY (no deploys, no GTM/GA4/Ads edits, no D1 writes, no ad clicks, no checkout/quote/payment/email actions)  
**Site:** `https://www.mildmate.com`  
**Canonical GA4:** Property `308922589`, Measurement ID `G-0GWVSPJLVJ`  
**GTM:** `GTM-KLJZZM9` (published v17)  
**Google Ads account under audit:** `524-268-1268`  
**Campaign under audit:** `US_Search_CushionProtector_PetsKids_202610`  
**R2 deployment:** `a54fc741-c064-4217-9605-f2ee5edffb86` at `2026-10-20 08:29:56 UTC` (`15:29:56 ICT`)

---

## Executive diagnosis

This is **not a single-cause failure**.

1. **Pre-R2 period (Oct 18 through Oct 20 15:29 ICT)** was affected by the known pre-R2 tracking break and is expected to have missing canonical collection.
2. **Post-R2 collection is active** (GA4 debug shows `session_start` and `page_view` in Oct 18–20 window), so the pipeline is no longer fully dark.
3. Paid Search = 0 in GA4 can still happen from a mix of:
   - consent-gated measurement (no consent = no session),
   - attribution/classification configuration outside website code (auto-tagging/manual UTM/linking/GA4 channel config),
   - reporting latency and collector freshness windows.

**Critical point:** website code currently shows no evidence of stripping `gclid`/campaign params on landing, and domain redirects preserve query strings.

---

## Evidence scope and access limits

### What was directly verified
- Live website redirect and query preservation behavior.
- Live production analytics bootstrap and consent scripts.
- Published GTM container payload (`gtm.js`) content.
- Production D1 read-only tables: `ga4_funnel_daily`, `sync_runs`, `google_ads_campaign_daily`.
- Authenticated read-only diagnostics from `mildmate-marketing-sync` (`/ga4/*`, `/google-ads/*`) using existing sync token.

### What could not be directly verified in this environment
- Google Ads UI settings (ad-level Final URL, tracking template, final URL suffix, account timezone, auto-tagging toggle).
- GA4 Admin UI link status to Ads account and data-sharing toggles.
- GA4 UI Traffic Acquisition for intraday channel-grouping slices.

These are marked **HOLD / NOT VERIFIED** below.

---

## Task A — Date/timing reconciliation (Oct 18–20)

## A1) Timezone findings
- **GA4 property timezone: CONFIRMED `Asia/Bangkok`** via authenticated `/ga4/debug-property`:
  - `time_zone: "Asia/Bangkok"`
- **Google Ads account timezone: NOT VERIFIED** (not exposed by current read-only endpoints; Ads UI/API account settings view required).

## A2) Best available click/session timeline (timestamped)

| Window | UTC | ICT (Asia/Bangkok) | Ads evidence | GA4 evidence | Interpretation |
|---|---|---|---|---|---|
| Pre-R2 broken window | 2026-10-18 00:00 → 2026-10-20 08:29:55 | 2026-10-18 07:00 → 2026-10-20 15:29:55 | Owner screenshots show at least 9 visible clicks across Oct 18–20; at least part is pre-R2 | Canonical D1 freshness currently ends at 2026-10-17; no D1 rows yet for 18–20 | Pre-R2 missing canonical collection is expected from prior incident state |
| R2 cutover instant | 2026-10-20 08:29:56 | 2026-10-20 15:29:56 | — | R2 deployed and verified | Collection architecture restored |
| Post-R2 same-day window | 2026-10-20 08:29:56 onward | 2026-10-20 15:29:56 onward | Owner screenshot for Oct 20 shows at least 4 visible clicks total day (cannot split pre/post from screenshot alone) | GA4 debug-events for 2026-10-18..20 shows `session_start=11`, `page_view=20` | Canonical GA4 is receiving sessions/events again, but Paid Search classification remains unresolved |

## A3) Collector freshness impact
- GA4 collector status (`/ga4/status`):
  - `latest_report_date` (website scope) = **2026-10-17**
  - `last_success_sync_at` = **2026-10-19T01:03:09.989Z**
- Google Ads collector status (`/google-ads/status`):
  - `latest_report_date` = **2026-10-12**

So D1 is currently **not a source of truth for Oct 18–20 paid clicks** yet. This is a freshness/schedule boundary, not proof of zero traffic.

## A4) Missing pre-R2 data: delayed vs permanent
- **Pre-R2 event loss is effectively permanent** at GA4 raw collection level (events never collected in that window cannot be backfilled from site logs).
- **Post-R2 data may still appear in downstream dashboards later** due collector schedule/latency, but this does not recover pre-R2 lost events.

---

## Task B — Actual Google Ads landing URL path and click-ID preservation

## B1) Redirect and parameter preservation (confirmed)
- `https://mildmate.com/?gclid=...&utm_source=google&utm_medium=cpc`  
  → `301` to `https://www.mildmate.com/?gclid=...&utm_source=google&utm_medium=cpc` (params preserved)
- `https://mildmate.com/product/...?...`  
  → `301` to same `www` URL with params preserved
- `https://www.mildmate.com/product/...?...`  
  → `200` (no redirect stripping params)

## B2) Client-side stripping checks (confirmed for website code)
- No campaign-parameter stripping found in inspected live scripts (`analytics-env.js`, `cookie-consent.js`, `product-configurator.js`, `cart.js`, `nav.js`, `geo.js`, `reviews-carousel.js`, `configurator.js`, `listing-images-sync.js`).
- `clerk.js` does use `history.replaceState`, but only to remove `__clerk_*` handshake params, not `gclid/gbraid/wbraid/utm_*`.

## B3) Auto-tagging and ad destination settings
- **NOT VERIFIED (HOLD)** in this environment:
  - ad-level Final URLs
  - tracking template/final URL suffix
  - account auto-tagging toggle
  - presence of `gclid/gbraid/wbraid` on real ad clicks

Keyword-level Final URL dashes were **not** treated as proof of missing ad destinations.

---

## Task C — Campaign attribution path analysis

## C1) page_location / campaign param path
- Runtime does not strip paid params in redirects or client JS (verified).
- No evidence of Cloudflare rewrite dropping query params on tested paths.

## C2) GTM initialization and consent timing
- Production now uses consent-driven analytics bootstrap (`analytics-env.js` + `cookie-consent.js`).
- GTM loads only when consent indicates analytics or marketing granted.
- This means **ad clicks without consent can produce zero GA4 sessions by design** (expected Basic Consent behavior).

## C3) `session_start` / `page_view` delivery
- Authenticated GA4 debug-events for 2026-10-18..20 show:
  - `session_start`: 11
  - `page_view`: 20
- Therefore canonical GA4 is not fully dark in that range.

## C4) Canonical destination correctness
- `/ga4/debug-property` confirms:
  - property `308922589`
  - stream `3376637775`
  - measurement ID `G-0GWVSPJLVJ`
  - default URI `https://www.mildmate.com`

## C5) Misclassification hints in available historical rows (pre-18 window)
- In D1 canonical rows (10/10–10/17), `source='google'` + `medium='cpc'` appears with campaign values that include `"(organic)"`/empty in some rows.
- This is a **data-quality attribution warning**, not conclusive root cause for Oct 18–20.

## C6) Internal/dev filters, referral exclusions, self-referrals
- **Internal/developer traffic filters:** NOT VERIFIED (GA4 UI config needed).
- Historical canonical rows include referral sources such as:
  - `kind-joey-29.clerk.accounts.dev`
  - `checkout.stripe.com`
  - `tagassistant.google.com`
  This suggests referral exclusion/filtering may be incomplete and can contribute attribution distortion.

## C7) “gclid arrives but lost before GA4 session” hypothesis
- **Not confirmed by website code**: no stripping path found.
- Still **not fully disproven** for real ad clicks because ad config + browser privacy behavior + consent path can alter outcomes.

---

## Task D — GA4/Ads linkage and acquisition reporting status

## D1) What is confirmed
- Ads data in D1 belongs to customer ID `5242681268` (matches `524-268-1268` normalized).
- GA4 canonical property/stream identity is confirmed (`308922589` / `G-0GWVSPJLVJ`).

## D2) What is not confirmed (HOLD)
- GA4↔Google Ads product link status in GA4 Admin.
- Data-sharing flags on that link.
- Whether campaign/cost import state is complete in GA4 UI.
- Traffic Acquisition channel-grouping output for Oct 18–20 in GA4 UI.

These require owner-side Google UI checks.

---

## Task E — Conversion tracking diagnosis (separate)

Published GTM container evidence:
- Google Ads conversion tag type `__awct` exists with:
  - conversion ID `18373693725`
  - conversion label `ODYACIyL8pMdEJ2ioblE`
  - `orderId` mapped to `eventModel.transaction_id` (dedupe key)
  - value/currency mapping from event model
- Conversion Linker `__gclidw` is present.

GA4/Ads routing findings:
- Purchase routing path exists.
- `view_quote` and `quote_request` are absent from the shared 5-event GA4 regex trigger:
  - current regex: `^(view_item|add_to_cart|view_cart|begin_checkout|purchase)$`

Duplicate-risk assessment:
- Purchase duplicate risk appears **bounded** by transaction_id mapping in Ads tag.
- Do **not** add a second Ads Purchase tag.

---

## Task F — Safe technical verification compliance

Completed safely:
- No live ad clicks were generated.
- No GTM/GA4/Ads/Cloudflare config mutations were made.
- No production writes were made via `/ga4/run` or `/google-ads/run`.
- No customer/order/quote/payment actions were performed.

---

## Task G — Root-cause classification matrix

| Domain | Status | Classification | Evidence |
|---|---|---|---|
| 1) Pre-R2 missing paid traffic | Missing canonical collection expected in broken window | **CONFIRMED DEFECT (historical window)** | Known pre-R2 incident + cutover timing |
| 2) Post-R2 paid-session collection | Collection resumed, but paid-channel attribution unresolved | **CONFIRMED EXPECTED BEHAVIOR** for resumed collection; **NOT VERIFIED** for paid-channel attribution | GA4 debug-events show session_start/page_view after R2 |
| 3) Google Ads campaign attribution | Zero Paid Search despite clicks may be attribution/config/consent mix | **LIKELY HYPOTHESIS** | Params preserved, no stripping, yet GA4 Paid Search screenshot is zero |
| 4) Conversion tracking | Purchase Ads tag + linker + transaction_id mapping present | **CONFIRMED EXPECTED BEHAVIOR** (for purchase path) | GTM container inspection |
| 5) GA4 reporting latency/intraday effects | D1 freshness windows lag real-time periods | **CONFIRMED EXPECTED BEHAVIOR** | `/ga4/status` latest website report date 2026-10-17 |
| 6) Collector/D1 freshness | Ads D1 currently ends at 2026-10-12; GA4 D1 at 2026-10-17 | **CONFIRMED EXPECTED BEHAVIOR** (schedule freshness), not proof of zero traffic | `/google-ads/status`, `/ga4/status`, D1 queries |

---

## PASS / FAIL / HOLD matrix

| Check | Verdict | Notes |
|---|---|---|
| Domain redirect preserves click params | **PASS** | `mildmate.com -> www` keeps `gclid/utm_*` |
| Client JS strips gclid/utm before analytics init | **PASS** | No stripping path found |
| Clerk cleanup strips paid params | **PASS** | Only removes `__clerk_*` |
| Canonical GA4 property/stream identity | **PASS** | Confirmed via `/ga4/debug-property` |
| Post-R2 event collection alive | **PASS** | `session_start` and `page_view` present in Oct 18–20 debug |
| Paid Search sessions visible in GA4 Home screenshots | **FAIL (observed)** | Owner screenshots show zero |
| Ads hourly/day breakdown for Oct 18–20 from internal telemetry | **HOLD** | D1 Ads freshness only up to 2026-10-12 |
| Google Ads account timezone | **HOLD** | Requires Ads account settings/API detail not exposed here |
| Ad-level Final URL / tracking template / suffix | **HOLD** | Requires Ads UI/API access |
| Auto-tagging ON/OFF | **HOLD** | Requires Ads UI/API access |
| GA4↔Ads product link/data sharing state | **HOLD** | Requires GA4 Admin UI/API scope not exposed here |
| Purchase conversion tag dedupe | **PASS** | `transaction_id` mapping present in Ads tag |
| Quote event forwarding in GTM | **FAIL** | `view_quote/quote_request` absent in shared regex |

---

## Minimal proposed repairs (do not execute yet)

1. **Attribution configuration verification first (owner-side, no code):**
   - Confirm Ads auto-tagging is ON.
   - Confirm enabled ad Final URLs + tracking template/suffix do not rewrite away click IDs.
   - Confirm GA4↔Ads product link/data sharing status.
   - Check GA4 Traffic acquisition (Session source/medium + Session default channel group) specifically for Oct 20 **after 15:29 ICT**.

2. **GTM event-routing completion:**
   - Extend GA4 forwarding regex to include `view_quote|quote_request`.
   - Keep single Ads Purchase tag (no duplicate purchase tag creation).

3. **If Paid Search still zero after (1):**
   - Investigate consent acceptance rate impact on paid landing sessions (Basic Consent can intentionally suppress non-consented sessions).
   - Audit referral exclusions/internal filters in GA4 Admin.

---

## Owner-only verification instructions

1. In **Google Ads** account `524-268-1268`:
   - Check account timezone.
   - Check auto-tagging.
   - Export ad-level Final URL + tracking template + final URL suffix for campaign `US_Search_CushionProtector_PetsKids_202610`.

2. In **GA4 property 308922589**:
   - Admin → Product links → Google Ads link status and data sharing.
   - Reports/Explore for Oct 18–20:
     - Session source/medium
     - Session default channel group
     - Session campaign
   - Segment pre/post cutover on Oct 20 at 15:29 ICT if possible.

3. In **GTM**:
   - Validate current shared event trigger scope.
   - Confirm no duplicate purchase conversion path.

---

## Risks and rollback plan (for later repair phase)

No repair was executed in this audit.

If/when a repair is approved:
- **Code-side rollback:** use existing Cloudflare Pages deployment rollback controls (R2 currently active).
- **GTM rollback:** republish prior container version.
- **Ads/GA4 config rollback:** revert changed toggles/link settings in platform UIs.

---

## Recommended next action

Proceed with a **configuration-evidence pass** (Ads + GA4 UI exports) before any code changes.  
Current evidence says website parameter handling is healthy post-R2, and the remaining gap is most likely attribution/config + consent-behavior interplay rather than URL parameter loss in front-end code.

**Stop here per instruction. Await separate approval before repairs.**
