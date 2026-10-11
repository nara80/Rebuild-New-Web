# GA4 Remediation — Release Readiness Report (2026-10-10)

**Branch:** `ga4/remediation-isolated` (isolated worktree `D:\00_mildmate\re-build_web_ga4_iso`)
**Base RC:** `327e667` (stripe hardening)
**Commits:** `5505d4e` (website unification) · `d0815cf` (marketing-sync property) · `b19efe2` (encoding repair + 53-page unification) · `aaa7182` (test suites) · `506a6e4` (browser matrix)
**Mandate boundary honored:** no push, no merge, no deploy, no D1 migration, no GTM publish, no GA4 property changes, no test events to production GA4/Ads.

---

## 1. Verdict: CONDITIONAL GO

GO to proceed to coordinated release **after** the external dependencies in §9 are approved and executed. The branch itself is internally consistent and verified; nothing on it can be safely released unilaterally because the fix only takes effect when website + GTM + marketing-sync change together.

## 2. Root cause (recap, evidence-based)

- Production commit `3741b40` hardcodes legacy Measurement ID `G-ESL161CNBV` inline on every page (introduced by legacy commit `8e66133 "update GA, GTM"`).
- GTM container v16 (`GTM-KLJZZM9`) has a `__googtag` config tag for the canonical `G-0GWVSPJLVJ` but **no GA4 event tags** (only an Ads `__awct` tag on `purchase`).
- marketing-sync worker pinned website property `366290587` (not canonical `308922589`).
- Net effect: the canonical property `308922589` receives **no ecommerce events from the website today**; prod D1 `ga4_funnel_daily` contains only properties `366290587` (legacy website) and `533944293` (Etsy).

## 3. What this branch changes

1. **Single analytics bootstrap** (`public/js/analytics-env.js`): canonical `G-0GWVSPJLVJ` + `GTM-KLJZZM9`, host-based environment resolver, consent gate, `__mildmateTrackEvent` → dataLayer `{event, eventModel, ecommerce}` (ecommerce alias for `view_item/add_to_cart/view_cart/begin_checkout/purchase`), mobile lazy-load.
2. **Website-wide unification:** 0 references to `G-ESL161CNBV` remain in `public/` + `templates/` (verified by grep); pages now bootstrap via `analytics-env.js` and push events through `__mildmateTrackEvent` (gtag fallback retained for robustness only).
3. **Consent script added** to checkout + order-confirmed (EN/TH); `cookie-consent.js` no longer loads GA4 itself, pushes `mildmate_consent_update` and calls `__mildmateLoadAnalytics`.
4. **EN checkout** adds `view_cart` with cart-signature dedupe. **TH order-confirmed** gains purchase hardening parity (`payment_verified` + `purchase_reportable` gates, reportable-status filter, `purchase_reportable_value`).
5. **marketing-sync:** website property `366290587` → `308922589` (Etsy `533944293` untouched; historical D1 rows preserved).
6. **No changes** to `functions/` (SSR middleware runtime-config mechanism inherited from RC and verified).

## 4. Test evidence

| Check | Result |
|---|---|
| `node --check` on analytics-env / cookie-consent / product-configurator / marketing-sync index | OK |
| Encoding scan (`scripts/qa-encoding-scan.js`, 146 files) | Clean except 2 pre-existing mojibake files (§8) |
| Legacy ID grep (`G-ESL161CNBV`, `gtag/js`) in public/ + templates/ | 0 matches |
| vitest (4 files): stripe hardening, email safety, analytics isolation, dataLayer contract | **50/50 passing** |
| Browser matrix (`scripts/qa-browser-matrix.mjs`, headless Edge + local wrangler pages dev, all GTM traffic intercepted with staging IDs) | **14/14 passing** |

Browser matrix coverage: consent granted (EN desktop, pre-set) → GTM requested exactly once with staging ID, `gtm.js` in dataLayer, banner suppressed; consent denied → zero GTM requests, `mildmate_consent_update` pushed without `gtm.js`; TH mobile accept flow → GTM loads, banner hides; product page → `view_item` with `eventModel` + `ecommerce` alias; order-confirmed verified mock → `purchase` with `transaction_id` + numeric value; unverified mock → purchase suppressed; production IDs injected on localhost → blocked by resolver (no GTM request).

Duplicate-send analysis: `sendGa4Event` routes through `__mildmateTrackEvent` and returns; the gtag fallback only executes if `analytics-env.js` failed to load, in which case no tag container exists to consume the event (no network call, no duplicate). No page loads `gtag/js` directly anymore, so no inline-config + GTM-config double page_view.

## 5. GTM configuration package (draft — to apply in the GTM workspace, requires publish approval)

Container `GTM-KLJZZM9`, current version v16. After website deploy:

1. **Keep** existing `__googtag` (Google tag) for `G-0GWVSPJLVJ` on All Pages — this alone restores page_view delivery to canonical property at release.
2. **Add** GA4 Event tag "GA4 Event — ecommerce router":
   - Event Name: `{{Event}}` (built-in dataLayer event variable)
   - Trigger: Custom Event, regex `^(view_item|add_to_cart|view_cart|begin_checkout|purchase)$`
   - Send Ecommerce data: ON, Data Source: Data Layer (`ecommerce` object)
   - Measurement ID: `G-0GWVSPJLVJ`
3. **Verify** the Ads `__awct` purchase tag reads `transaction_id`, `value`, `currency`, `items` from `eventModel.*` data-layer variables (our contract test locks these names). If the tag currently reads top-level `ecommerce.*` only, repoint to `eventModel` — both are pushed identically on this branch.
4. **Variables to add (if absent):** DLV `eventModel` (Default: `{}`), DLV `ecommerce`, DLV `eventModel.transaction_id`, `eventModel.value`, `eventModel.currency`.
5. **No consent-mode tags needed** for the recommended Basic approach (§6); do not add a Consent Initialization tag.
6. Preview in GTM Preview mode against the deployed site after release; publish as a new version with notes.

## 6. Consent Mode v2 audit + recommendation

**Current implementation (this branch):** a classic **consent-gated load** — nothing (not GTM, not gtag) loads until `mildmate-cookie-consent.analytics === true` in localStorage. Banner has a single Analytics category (essential + analytics; no marketing category). **Not** Google Consent Mode: there is no `gtag('consent', 'default', …)` call and no `ad_storage / ad_user_data / ad_personalization / analytics_storage` signals anywhere (grep-verified). `mildmate_consent_update` is a site-internal dataLayer event, **not** Google's consent protocol.

**Duplicate-risk note:** the GTM container contains an Ads conversion tag. When a visitor accepts the (analytics-only) banner, GTM loads and Ads tags can fire under analytics-only consent. The banner does not offer a marketing opt-in. This is a policy decision, not a code bug.

**Recommendation: Basic Consent Mode (formalized), not Advanced.**
- Rationale: Advanced Consent Mode sends cookieless pings before consent — data transmitted to Google pre-consent — which is the exact trade-off this implementation currently avoids, and the business gains little conversion modeling from it (traffic is primarily US/TH/AU; no EU modeling pressure documented).
- Minimal hardening path (no policy change required): keep the load gate, and **before GTM loads** push `gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })`, then on banner accept push `consent update` with `analytics_storage: 'granted'` (+ marketing signals only if/when a marketing category is added). This makes the gating legible to Google systems and future-proofs Ads measurement, with ~10 lines in `analytics-env.js` / `cookie-consent.js`.
- If Ads conversion accuracy matters more than strict pre-consent silence, Advanced can be revisited later as a separate approved change.

## 7. Admin routes — does /admin/* + /super-admin/* need GA4?

Current branch unified the admin dashboards onto the same bootstrap (they will send page_view/consent state when logged in). **Recommendation: exclude admin surfaces from GA4.**
- They are Clerk-role-gated + Cloudflare Access allowlisted, used only by staff; including them pollutes marketing data (session counts, engagement, funnels) with internal traffic.
- Cleanest option: strip the analytics bootstrap from the 4 admin HTML files (`admin/index.html`, `admin/blog.html`, `admin/templates.html`, `super-admin/index.html`) — one commit.
- Alternative: keep them and add an internal-traffic data filter (property `308922589` → Data Settings → Data Filters → Internal Traffic, rule on office/home IPs) — but IP-based filters miss roaming staff.
- Decide before release; the strip is the safer default and reversible later.

## 8. Findings & risks

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Pre-existing mojibake in `public/deep-pocket/index.html` + `public/products/index.html` (verified present at RC `327e667`, not introduced by branch) | Low | Flagged; pre-existing |
| 2 | TH checkout has no `view_cart` (EN does) — language parity gap | Low | Flagged; add in follow-up if desired |
| 3 | Quote page (`/quote/QT-…/`) pushes `view_quote`/`add_to_cart` into dataLayer but never loads GTM/GA4 — dead events (pre-existing) | Low | Flagged; either bootstrap it or remove the pushes |
| 4 | SSR blog pages (`/blogs/`, `/th/blogs/`, posts) ship **no analytics at all** (pre-existing; `functions/blog-shared.ts` renders no bootstrap) | Medium | Flagged; blog traffic invisible to GA4 |
| 5 | Ads tags fire under analytics-only consent (§6) | Policy | Owner decision |
| 6 | Coordinated release requirement: website deploy + GTM publish + marketing-sync worker deploy must land together, or collectors ingest a property with no data (and vice versa) | Release | §9 sequence |
| 7 | GA4 Data API auth for property `308922589` in marketing-sync not verified from this environment (collector dry-run needs the deployed worker) | Medium | Verify at release step 3 |
| 8 | Historical gap: canonical property has no website history before release; legacy property `366290587` history remains in D1 only | Accepted | Backfill not possible retroactively |
| 9 | Previews/CI: SSR middleware injects `nonProductionApproved:false` on non-prod branches — analytics disabled by default (verified in browser tests) | Working as designed | — |

## 9. Coordinated release sequence (each step needs its own approval)

1. **Website deploy:** merge branch → deploy Pages (per repo deploy workflow; `--no-bundle` rule if functions are rebuilt — no function changes on this branch).
2. **GTM:** apply §5 config in the workspace, preview against live site, publish.
3. **marketing-sync:** deploy worker with updated `GA4_PROPERTIES_JSON`; run a manual pass and confirm `sync_runs` row ingests property `308922589` with non-zero website sessions.
4. **Post-release verification (48–72h):** GA4 DebugView/Realtime for `view_item`/`add_to_cart`/`begin_checkout`/`purchase`; check `ga4_funnel_daily` gains `308922589` rows; Ads conversions still fire on purchase.
5. **Consent Mode formalization** (§6) and admin strip (§7) can ship as fast-follows.

**Rollback:** website reverts by redeploying previous Pages build (bootstrap is self-contained per commit); GTM rollback = republish previous container version; marketing-sync rollback = restore `GA4_PROPERTIES_JSON` env var. D1 historical rows are append-only; no migration rollback needed. No D1 migration accompanies this release.

## 10. Explicitly not done (awaiting separate approvals)

- Production D1 migration 057, Stripe hardening deploy, GA4 Data API auth verification, any GTM publish, any deploy, any test event to production GA4/Ads.
- Consent Mode formalization, admin-strip commit, TH `view_cart`, quote-page decision — recommended follow-ups, not in QA mandate scope.
