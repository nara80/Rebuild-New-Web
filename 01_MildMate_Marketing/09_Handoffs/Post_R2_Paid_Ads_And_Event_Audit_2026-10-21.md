# Post-R2 Paid Ads and Event Audit (Read-Only)

**Date:** 2026-10-21  
**Mode:** Strict read-only (no code/config/deploy/UI changes)  
**Scope:** Paid attribution + consent behavior + ecommerce signal integrity + admin contamination + minimal segmented remediation plan  

---

## 0) Executive Outcome

**Recommendation: HOLD** on any broad repair release until owner UI checks are completed (auto-tagging/link/tracking-template state).  
**Ready now:** a minimal, low-risk fix plan is prepared and segmented (P0/P1/P2/POLICY) below.

What is already proven:
1. R2 stack is live and canonical IDs are active (`GTM-KLJZZM9`, `G-0GWVSPJLVJ`).
2. URL params (`gclid`,`gbraid`,`wbraid`,`utm_*`) survive `mildmate.com -> www.mildmate.com` redirects.
3. Ads collector now has click rows through **2026-10-19** (customer `5242681268`, campaign `24321425466`).
4. Six live product pages still ship no ecommerce producers (`view_item` / `add_to_cart`).
5. 4 BedBridge console errors are Ads remarketing beacon CSP redirect-chain blocks, not GA4 collection failures.

---

## 1) Evidence Sources (current run)

- Live page/script fetches from `www.mildmate.com`.
- D1 read-only SQL on `mildmate-db-prod`.
- Authenticated diagnostics: `/ga4/debug-property`, `/ga4/debug-events`, `/ga4/status`, `/google-ads/status`.
- Prior root-cause report cross-check: `ViewItem_Missing_RootCause_2026-10-20.md`.

No writes were performed.

---

## 2) Task A — Paid Attribution Chain (Ads -> Landing -> GA4)

## A1. Redirect and param preservation

**PASS**
- `mildmate.com` 301 preserves full query string to `www.mildmate.com`.
- Verified with `gclid`,`gbraid`,`wbraid`,`utm_source`,`utm_medium`,`utm_campaign`.

## A2. Canonical property/stream status

**PASS**
- GA4 property: `308922589`
- Stream: `G-0GWVSPJLVJ`
- Timezone: `Asia/Bangkok`
- Recent GA4 sync status: success (latest report date currently 2026-10-17 in D1 window).

## A3. Ads collector freshness and click reconciliation

**PASS**
- Google Ads status shows successful run at 2026-10-21 01:00 UTC, latest report date 2026-10-19.
- D1 rows confirm clicks for campaign `24321425466` on 10/18 (2) and 10/19 (3), plus other dates.

## A4. GA4 paid rows present but inconsistent campaign labeling

**HOLD**
- `ga4_funnel_daily` contains `source=google`, `medium=cpc` rows (so paid attribution path is not completely broken).
- But many `google/cpc` rows carry `campaign=''` or `campaign='(organic)'`, which is inconsistent.
- This requires owner UI verification of Ads auto-tagging + final URL/tracking-template hierarchy.

## A5. Oct 18-20 split reality

**PASS (facts) / HOLD (hour split proof)**
- Oct 18-19 clicks are now evidenced in Ads rows and were inside the known dark window before R2 restoration.
- Exact Oct 20 before/after 15:29 ICT split still requires Ads UI hour segmentation (not available from current daily-grain D1 rows).

---

## 3) Task B — Consent Mode Behavior (A-G)

Live scripts indicate **Consent Mode v2 Basic** with GTM consent template ownership.

| Scenario | Result | Verdict |
|---|---|---|
| A) First visit, no consent | GTM not loaded, no analytics tags fire | PASS |
| B) Consent grant on landing | `mildmate_consent_update` push + loader starts | PASS |
| C) Navigate before grant | No analytics until consent exists | PASS |
| D) Returning consented user | Consent mirrored to cookie + loaded on init | PASS |
| E) Reject all | analytics/marketing denied state maintained | PASS |
| F) Withdraw consent later | revocation transition events emitted if container loaded | PASS |
| G) Mobile lazy load | GTM deferred until interaction or 6s timeout | HOLD (intentional policy, but can undercount short bounces) |

Important nuance:
- Site payloads do not explicitly inject `page_location/page_referrer` on each ecommerce push; GA4 page context is relied on from browser/gtag context.

---

## 4) Task C — Source/Medium Nuance and Attribution Drift

## C1. Blank source/medium rows

**HOLD**
- Recent dates include small counts of rows with `source=''` and `medium=''` (including one purchase on 2026-10-17 in current table state).
- Could be ingestion/dimension edge cases or unattributed sessions, not yet proven to be a transport bug.

## C2. Non-marketing referral noise in source mix

**PASS (observed)**
- Rows include `kind-joey-29.clerk.accounts.dev`, `tagassistant.google.com`, `checkout.stripe.com` referrals.
- This confirms technical traffic/noise is present in canonical attribution tables and should be policy-filtered in reporting.

---

## 5) Task D — BedBridge errors + missing events

## D1. `view_item` / `add_to_cart` on BedBridge

**FAIL (confirmed)**
- BedBridge page has no ecommerce producer script and no inline `dataLayer.push` for these events.
- Add-to-cart UX works functionally, but analytics event is absent.

## D2. 4 console errors classification

**PASS (classified)**
- 4 errors map to Ads remarketing/viewthrough beacons (`doubleclick` + `1p-user-list`) blocked by CSP redirect chain ending on `www.google.co.th`.
- This affects Ads audience/viewthrough signals, not GA4 core collection.

## D3. Intermittent description fetch error

**HOLD (cosmetic/transient)**
- Intermittent `/api/products/{slug}` fetch failure observed historically but endpoint itself returns 200 and page has fallback content.

---

## 6) Task E — Ecommerce Producer Coverage (including custom cushion)

Live scan of 32 product URLs:
- **Missing producers (6):**
  - `bedbridge-connector`
  - `duvet-insert`
  - `marine-fitted-sheet`
  - `marine-mattress-protector`
  - `marine-top-sheet`
  - `mattress-lift-helper`
- `standard-fitted-sheet`: has configurator producer.
- `custom-waterproof-cushion-protector`: has configurator producer.

**Verdict:** **FAIL** for full-catalog ecommerce signal completeness.

Additional event-scope findings:
- GTM published regex currently matches only: `view_item|add_to_cart|view_cart|begin_checkout|purchase`.
- `view_quote` and `quote_request` are not covered by that shared GA4 ecommerce trigger.

Token handling:
- `quote_request` in `product-configurator.js` is tokenized via SHA-256 prefixing (`mildmate-quote:` salt pattern) before push. **PASS**.
- Live quote-page `view_quote` token handling could not be re-verified in this run without exposing a real quote URL in output. **HOLD** (source indicates raw quote_id is still used there; production verification still required).

---

## 7) Task F — Admin / Super-admin analytics contamination

**FAIL (policy/measurement hygiene)**

- `public/admin/index.html` and `public/super-admin/index.html` still include direct analytics bootstrap with legacy GA4 ID `G-ESL161CNBV` plus GTM load.
- Global middleware skips `/admin/` and `/super-admin/`, so these pages bypass the main consent-gated public-site analytics bootstrap.
- This can contaminate canonical property traffic if admin users are not excluded at property/filter level.

---

## 8) Task G — Minimal Segmented Remediation Plan

## P0 (Owner UI verification, no code)
1. Confirm Ads auto-tagging ON (customer `524-268-1268`).
2. Confirm GA4<->Ads link active for property `308922589`.
3. Confirm no destructive tracking template/final URL suffix overrides.
4. Confirm Ads account timezone for Oct 20 hour-split interpretation.

## P1 (GTM only)
1. Extend shared GA4 ecommerce trigger regex to include `view_quote|quote_request`.
2. Keep existing purchase/Ads dedupe structure unchanged.

## P2 (Site code)
1. Add `view_item` + `add_to_cart` producers to the 6 affected templates/pages.
2. Add regional Google Ads beacon hosts needed by redirect-chain behavior (or explicitly accept audience-beacon loss as policy).
3. Isolate admin analytics from canonical public reporting (property-level exclusion and/or remove legacy bootstrap).

## POLICY
1. Keep canonical attribution reports filtered to business traffic (exclude tagassistant/admin/referral noise).
2. Keep read-only verification checklist for every analytics cutover (IDs, consent, redirects, trigger coverage, sample event smoke test).

Rollback note (if code changes are approved later): deploy-level rollback to last known good Pages deployment remains available.

---

## 9) PASS / FAIL / HOLD Matrix

| Check | Verdict |
|---|---|
| R2 live and canonical IDs active | PASS |
| Redirect query preservation (`gclid/gbraid/wbraid/utm_*`) | PASS |
| Ads collector freshness through 2026-10-19 | PASS |
| Paid rows exist in GA4 funnel (`google/cpc`) | PASS |
| Campaign labeling consistency for paid rows | HOLD |
| Consent mode basic flow correctness (A-F) | PASS |
| Mobile lazy-load bias risk (G) | HOLD |
| BedBridge `view_item`/`add_to_cart` | FAIL |
| Full product coverage of ecommerce producers | FAIL |
| 4 console errors root-caused/classified | PASS |
| GTM coverage includes quote events | FAIL |
| Quote page token leakage re-verification (live) | HOLD |
| Admin/super-admin contamination controls | FAIL |

---

## 10) Final Recommendation

**Current decision: HOLD.**  
Proceed with **P0 owner UI verification first**. Then, if owner approves implementation, execute **P1 + P2** as a tightly scoped patch release.

No repairs were executed in this audit.
