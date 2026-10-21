# MildMate — Ads Paid-Search Attribution Verification (READ-ONLY, post-R2 day 1)

**Date:** 2026-10-21
**Mode:** READ-ONLY ONLY — no code changes, no deployments, no GTM publication, no Ads/GA4 configuration changes, no D1 writes, no ad clicks. Report committed to git only.
**Primary issue:** Google Ads Paid Search attribution in canonical GA4 property `308922589`.

---

## 1. R2 preserved (verification, not assumption)

| Check | Result | Evidence (2026-10-21) |
|---|---|---|
| Production deployment = R2 | **PASS** | `wrangler pages deployment list`: production top row `a54fc741-c064-4217-9605-f2ee5edffb86` (source `7d16b19`), no newer production deploy |
| Live homepage serves R2 stack | **PASS** | `analytics-env.js` present (1), `__mildmateInitAnalytics` bootstrap present (2), legacy `G-ESL161CNBV` **0** |
| R1 customer-facing fixes | **PASS** | Untouched since cutover — R1 parity was gate #3 of the R2 preflight (order-confirmed shim byte-identical); no deploy since R2 |

No restore to Oct 12 was performed (per owner instruction) and none is needed — R2 contains the Oct-12 GA4/Consent architecture plus R1 fixes.

---

## 2. Owner-side verification steps (exact clicks, Google UIs only)

### A. Google Ads auto-tagging
1. Google Ads (account **524-268-1268**) → Admin icon (top right) → **Account settings** → **Preferences** → **Account settings** → **Auto-tagging**.
2. Confirm **"Tagging" = ON** (gclid). If OFF, this alone explains Paid Search = 0. Do not change it yet — record the state first.

### B. GA4 ↔ Google Ads account link
1. GA4 property **308922589** → Admin → **Product links** → **Google Ads links**.
2. Confirm a link exists for customer **524-268-1268** and is active. Note the "Enable personalized advertising" state (read-only; do not toggle).
3. Cross-check from Ads side: Tools → Data manager → **Google Analytics** links.

### C. Final URLs, tracking template, suffix
1. Campaign `US_Search_CushionProtector_PetsKids_202610` → **Ads & assets** → open an enabled ad → read **Final URL**.
2. Campaign → Settings → **Campaign URL options**: Tracking template (expect empty) + Final URL suffix (expect empty or `{lpurl}`-safe — must not drop query string).
3. Account level: Admin → Account settings → **Tracking template** (expect empty).
4. Keyword-level Final URL column showing a dash = inherits the ad Final URL — **not** a missing landing page.
5. In each case the effective landing URL must be a `www.mildmate.com` URL; verified separately that both `mildmate.com → www` 301 redirects **preserve** `gclid`/`utm_*` query strings (live 301 probe, 2026-10-20).

### D. Account timezone
1. Ads → Admin → Account settings → **Time zone** (read-only after creation). GA4 is confirmed `Asia/Bangkok` (via `/ga4/debug-property`: `time_zone: "Asia/Bangkok"`, currency USD, stream `3376637775` / `G-0GWVSPJLVJ`).
2. Use this timezone when reading Ads dayparting (step E).

### E. Oct 20 click-timing split (before/after 15:29 ICT)
1. Ads → Campaigns → segment **Time → Hour** → date 2026-10-20.
2. Read clicks in account-timezone hours vs the 15:29 ICT (08:29:56 UTC) cut. Ads UI hours are in the **account timezone** — convert before comparing.
3. GA4 side: Explore → Free form → dimension **Date + Hour**, metric Sessions, filter Session source/medium = `google / cpc` — note GA4 hours are Asia/Bangkok.

---

## 3. Click reconciliation before vs after R2 (evidence-based)

**Ads-side daily clicks now in D1** (`google_ads_campaign_daily`, collector run 2026-10-21 01:00 UTC, status success — customer `5242681268`, campaign `24321425466`):

| Date (Ads) | Clicks | Impressions | Cost (THB) | vs R2 cut (Oct 20 15:29:56 ICT) |
|---|---|---|---|---|
| 2026-10-13 | 5 | 102 | 148.00 | pre-window |
| 2026-10-14 | 3 | 82 | 87.40 | pre-window |
| 2026-10-15 | 8 | 134 | 216.39 | pre-window |
| 2026-10-16 | 1 | 53 | 22.45 | pre-window |
| 2026-10-17 | 1 | 68 | 24.59 | pre-window |
| **2026-10-18** | **2** | 103 | 49.64 | **entirely pre-R2 → dark window, permanently uncollected in GA4** |
| **2026-10-19** | **3** | 88 | 74.23 | **entirely pre-R2 → dark window, permanently uncollected in GA4** |
| **2026-10-20** | not yet ingested | — | — | **hour split NOT VERIFIABLE from any read-only source available here** — see below |

**Evidence chain for the dark window:** the Oct 18 deployment (`1fc053c4`, source `bef97cb`) reverted the consent bridge; canonical GA4 could collect nothing Oct 18 00:00 → Oct 20 15:29 (architecture audit `7d16b19`); D1 `ga4_funnel_daily` stops at 2026-10-17, consistent. Therefore the **5 clicks on Oct 18–19 are accounted for as permanently lost**, with evidence — not assumed.

**Oct 20 (owner screenshot: ≥4 visible keyword clicks):** Ads API data in D1 is **daily-grain only** and does not yet include Oct 20 (collector window ends Oct 19; next scheduled run Mon **Oct 26 01:00 UTC**). Even after ingestion, daily grain cannot resolve the 15:29 split. **Only Ads UI hour segmentation (step 2E) can establish the before/after split — do not assume it.**

**GA4 processing latency:** canonical GA4 intraday counts lag (Debug API for Oct 20 showed `page_view=1, session_start=1, scroll=1` on 2026-10-20 query, unchanged on 2026-10-21 morning query — low-traffic intraday is expected to be incomplete). Post-R2 paid sessions may take 24–48 h to appear in standard reports.

---

## 4. Six product pages missing ecommerce event producers (separate audit)

**Method (reproducible):** `GET https://www.mildmate.com/product/{slug}/` and count occurrences of `product-configurator.js`, `dataLayer.push`, `view_item`, `add_to_cart`, `analytics-env.js` in served HTML (2026-10-21, live production):

| # | Page | configurator.js | dataLayer.push | view_item | add_to_cart | analytics loads |
|---|---|---|---|---|---|---|
| 1 | `/product/bedbridge-connector/` | 0 | 0 | 0 | 0 | yes |
| 2 | `/product/duvet-insert/` | 0 | 0 | 0 | 0 | yes |
| 3 | `/product/mattress-lift-helper/` | 0 | 0 | 0 | 0 | yes |
| 4 | `/product/marine-fitted-sheet/` | 0 | 0 | 0 | 0 | yes |
| 5 | `/product/marine-top-sheet/` | 0 | 0 | 0 | 0 | yes |
| 6 | `/product/marine-mattress-protector/` | 0 | 0 | 0 | 0 | yes |

**Interpretation:** GA4/Ads **page_view + session attribution work on all 31 product pages** (analytics-env.js present everywhere). What these 6 pages lack is only the ecommerce layer: `view_item` on load and `add_to_cart` on click. The only producers site-wide are `product-configurator.js:1184` (`view_item`) and `:1212` (`add_to_cart`), loaded exclusively by the customizable template (25 pages). Fixed-price and marine templates ship zero `dataLayer.push` calls — verified live (all counts 0) and in source. Add to Cart functions correctly on these pages (cart storage updated, "Added!" feedback) — only the analytics push is absent.

**Relation to Paid Search issue:** none for session classification (page_view carries attribution). It thins the funnel (product_views / add_to_cart metrics) for any campaign traffic landing on these 6 pages.

---

## 5. CSP-blocked requests — what they actually are

**Identified requests (HAR capture, 2026-10-20, owner's exact URL, 59 requests, 4 with status=0):**
1. `googleads.g.doubleclick.net/pagead/viewthroughconversion/18373693725/?…en=gtag.config…fmt=4`
2. `googleads.g.doubleclick.net/pagead/viewthroughconversion/18373693725/?…en=gtag.config…fmt=3`
3. `www.google.com/pagead/1p-user-list/18373693725/?…is_vtc=1`
4. `www.google.co.th/pagead/1p-user-list/18373693725/?…is_vtc=1&ipr=y`

**Classification — PROVEN by request structure and published-container code:**

| Concern | Verdict | Evidence |
|---|---|---|
| Conversion tracking | **NOT affected** | The Ads purchase conversion is tag `__awct` (label `ODYACIyL8pMdEJ2ioblE`), which fires `en=conversion` requests only on the `purchase` event. The blocked requests are all `en=gtag.config` (config ping) and 1p-user-list (audience list). Different request class, different tag. |
| GA4 attribution / Paid Search classification | **NOT affected** | `gclid` attribution is handled by the Conversion Linker (`__gclidw`) via first-party cookies and by GA4's own collection (`g/collect`, allowlisted and verified working). GA4 sessions do not depend on doubleclick beacons. |
| Remarketing / viewthrough audience signals | **AFFECTED — this is what is lost** | `viewthroughconversion` + `1p-user-list` are Ads audience/remarketing pings. For visitors whose redirect chain lands on `www.google.co.th` (Thailand geo), the beacons die. |

**Mechanism (proven):** single CSP header on the page (identical with/without query param; no meta CSP) allowlists `googleads.g.doubleclick.net` and `www.google.com` but **not `www.google.co.th`**. Verified 302 chain: `doubleclick/viewthroughconversion` → `www.google.com/pagead/1p-user-list/` → `www.google.co.th/pagead/1p-user-list/?ipr=y`. CSP evaluates every redirect hop; the `google.co.th` hop fails, the whole chain is blocked, and the violation is reported against the original (allowlisted) URL — confirmed live via `securitypolicyviolation` listener. Pre-existing since before R2 (CSP byte-identical to R1); not an R2 regression.

---

## 6. Minimum necessary fixes — separate release scopes

| Scope | Owner | Content | Fixes | Rollback |
|---|---|---|---|---|
| **RG-1 — GTM container** (owner-only, one publish) | Owner | Extend shared GA4 event trigger regex: `^(view_item\|add_to_cart\|view_cart\|begin_checkout\|purchase)$` → add `view_quote\|quote_request`. Do NOT create a second Ads purchase tag (existing `__awct` + transaction_id dedup is correct). Optional: delete vestigial zero-tag CE triggers. | Quote events reach canonical GA4 | Republish container v17 |
| **RA-1 — Ads/GA4 config** (owner-only, toggles) | Owner | If step 2A shows auto-tagging OFF → turn ON. If 2B shows no GA4–Ads link → create it. Record state first; change only what is actually wrong. | Paid Search attribution path end-to-end | Revert toggles in respective UIs |
| **RC-1 — Site code R2.1** (needs separate approval) | Droid | (a) Add `view_item`/`add_to_cart` producers to fixed + marine templates (6 pages), same payload shape as product-configurator.js. (b) Add `https://www.google.co.th` to `img-src`/`connect-src` in `_headers` + SSR CSP. | Funnel completeness on 6 pages; restores Ads audience signals for TH-geo visitors | Cloudflare Dash → Pages → mildmate-new → Rollback to `a54fc741` |
| **RD-1 — Optional collector pull** (needs approval; writes D1) | Droid | `POST /google-ads/run` and `POST /ga4/run` (manual) to pull Oct 20 into D1 before Monday's scheduled run. | Dashboard freshness days earlier | None needed (additive upserts) |

Independence: RG-1, RA-1, RC-1, RD-1 are mutually independent; none requires another. **None of these fixes restores the permanently lost Oct 18 – Oct 20 15:29 click data.**

---

## 7. PASS / FAIL / HOLD matrix

| # | Check | Verdict |
|---|---|---|
| 1 | R2 production preserved, R1 fixes intact | **PASS** (verified live 2026-10-21) |
| 2 | Owner-side Ads/GA4 verification steps provided | **PASS** (§2) |
| 3a | Oct 18–19 Ads clicks reconciled with evidence (5 clicks, all pre-R2, permanently lost in GA4) | **PASS** |
| 3b | Oct 20 clicks before/after 15:29 ICT split | **HOLD** — daily-grain Ads data not yet ingested and cannot resolve hours; Ads UI dayparting (2E) required |
| 3c | Post-R2 paid sessions appearing in GA4 | **HOLD** — GA4 processing latency + Monday collector run; recheck Oct 21–22 via Traffic acquisition `google / cpc` |
| 4 | Six pages without ecommerce producers identified with live evidence | **PASS** (§4) |
| 5 | CSP blocked requests identified and classified | **PASS** — remarketing/viewthrough only; conversion tracking and GA4 attribution unaffected |
| 6 | Minimal fixes scoped with rollback | **PASS** (§6) |
| — | Ads auto-tagging state | **HOLD** — owner UI check (2A) |
| — | GA4↔Ads link status | **HOLD** — owner UI check (2B) |
| — | Ads account timezone | **HOLD** — owner UI check (2D) |
| — | Ad Final URLs / tracking templates / suffix | **HOLD** — owner UI check (2C) |

---

## 8. Next owner-side verification step (single most valuable action)

**Do step 2E now (Ads UI → Campaigns → segment Time → Hour → Oct 20), together with 2A (auto-tagging ON/OFF) in the same visit.**

Interpretation guide:
- Clicks after 15:29 ICT exist AND auto-tagging is ON → expect `google / cpc` sessions in GA4 within 24–48 h; if still absent after that, run 2B (link check) and report back.
- Auto-tagging OFF → that is the root cause of the attribution gap; enabling it (RA-1) is the fix.

**Report only. No changes made to production, GTM, GA4, Ads, or D1 during this verification.**
