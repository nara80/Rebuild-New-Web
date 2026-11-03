# Cookie Consent UX Improvement — Preview Validation Report (2026-11-03)

Status: implemented and validated on an isolated Pages preview. **No production deploy, no commit, no push.** Awaiting owner approval.

## Preview builds

| Role | URL |
|---|---|
| Before consent-UX change | https://d62a03f4.mildmate-new.pages.dev |
| After consent-UX change | https://c1e59f4b.mildmate-new.pages.dev |
| Branch alias | https://security-admin-api-remediati-p2nk.mildmate-new.pages.dev |

## What changed

Single shared asset: `public/js/cookie-consent.js` (loaded by ~116 pages, EN + TH).

1. **Three first-layer choices** replacing the previous two-button layer:
   - EN: `Settings` / `Essential Only` / `Accept All Cookies`
   - TH: `ตั้งค่า` / `เฉพาะคุกกี้ที่จำเป็น` / `ยอมรับคุกกี้ทั้งหมด`
2. **Bilingual copy object** with language detection from `<html lang>` or a `/th/` path prefix; banner text, modal title, description, category labels, and save button are localized.
3. **Visual prominence per brand rules:** `Accept All Cookies` filled brand blue (`#2c96f4`), `Essential Only` outlined brand blue, `Settings` neutral.
4. **Responsive, tap-safe layout** injected as `#cookie-consent-ux-style`: 3-column grid on desktop, 2-column on tablet with `Settings` full width, single column on mobile; minimum 44px tap targets.
5. **Accessibility:** `:focus-visible` outlines on all controls, logical tab order (Settings → Essential Only → Accept All), modal title focusable (`tabindex="-1"`), focus moved into the modal on open and restored to the triggering element on close.
6. **Behavior preserved:** storage key `mildmate-cookie-consent`, `mm-consent` cookie mirror, `__mildmateSaveConsent`, `__mildmateAddConsentListener`, `applyConsent`, and the footer `Cookie Settings` entry are unchanged. The reject button keeps its id `cookie-btn-reject` (only the CSS class was renamed to `cookie-btn-essential`), so existing listeners and selectors still resolve.

## Validation

### 1. Consent UX behavior matrix — 24/24 PASS
12 pages (EN + TH: home, products listing, customizable product, fixed product, marine product, FAQ) × 2 viewports (1440×1024, 390×844).
Evidence: `consent-ux-behavior-matrix.json`

Checks per case: banner visible on first visit, localized labels correct, all three buttons present, no button overlap, all buttons inside the viewport, keyboard tab order, `Essential Only` writes `analytics:false/marketing:false` plus cookie `mm-consent=analytics:denied,marketing:denied`, choice persists after reload, Settings modal opens from the footer entry, granular save (analytics on / marketing off) persists, choice persists across navigation, `Accept All` writes both categories granted.

### 2. Consent gating matrix — PASS
6 product pages (EN + TH × customizable/fixed/marine) × 5 consent states (unset, denied, analytics only, marketing only, all granted).
Evidence: `consent-gating-matrix.json`

- `unset` and `denied`: **0** GTM loads.
- `analytics_only`, `marketing_only`, `all_granted`: **exactly 1** GTM load (no duplicate container).
- `view_item` present in every state (first-page ecommerce event not lost).
- Preview hosts are intentionally non-production for analytics, so a documented test-only `__MILDMATE_ANALYTICS_CONFIG` override with fake GTM/GA IDs was used to make loads observable. No real GTM/GA4/Ads property was touched.

### 3. Performance (Lighthouse, performance category only)
Evidence: `lighthouse/*.json`

| Case | Score | LCP | TBT | CLS |
|---|---|---|---|---|
| mobile EN | 97 → 98 | 1524 → 1661 ms | 182 → 143 ms | 0.001 → 0.001 |
| desktop EN | 100 → 100 | 530 → 549 ms | 0 → 0 ms | 0.006 → 0.006 |
| desktop TH | 98 → 99 | 724 → 650 ms | 98 → 77 ms | 0.007 → 0.009 |
| mobile TH | see note | 2209 → 2107 ms | 525 → 619 ms | intermittent |

**TH mobile note:** the first run showed CLS 0.429 after vs 0.004 before. Three repeat runs per build showed the ~0.43 shift appears in the **before** build too (before: 0.004 / 0.000 / 0.430; after: 0.429 / 0.425 / 0.002). The shift is attributed to `body.home-page > main`, is intermittent in both builds, and is therefore **pre-existing TH mobile homepage instability, not a regression from the consent UI**. It is worth a separate fix pass.

### 4. Auth / checkout / security sanity (read-only, no orders placed)
- `/checkout/` returns 200, renders, banner appears and dismisses cleanly; no blocking overlay (`body` overflow stays `visible`).
- Security headers intact on preview: CSP present, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `/api/auth/me` returns `{"authenticated":false}` (200, by design); `/api/customers/orders` returns 401 unauthenticated. Unchanged.
- `/account/` behaves as before (no middleware or Clerk code was touched in this workstream).

### 5. Parity and gates
- `node --check public/js/cookie-consent.js` passes.
- Consent JS is a **static asset**, not part of the Pages Functions bundle: `mildmate-cookie-consent`, `cookie-btn-essential`, and `Accept All Cookies` do not appear in `public/_worker.js` or `public/index.js`. **No bundle rebuild is required** for this change.
- `npx vitest run workers/api/__tests__/quote-ga4-measurement.test.ts workers/api/__tests__/analytics-isolation.test.ts` → **48 passed**.

## Open gap found during validation (needs a decision)

52 pages still load GTM through an inline loader that is **not** consent-gated, so `Essential Only` does not block GTM on them. Verified live on the preview:

| Page | Consent unset | Essential Only |
|---|---|---|
| `/` and `/th/` (shared loader) | 0 GTM | 0 GTM |
| product pages (shared loader) | 0 GTM | 0 GTM |
| `/faq/`, `/th/faq/`, `/products/` (inline loader) | 1 GTM | **1 GTM** |

Affected set: category pages, blog pages, FAQ/policy/shipping/sizeguide/reviews/fabric/about/contact, `/account/`, admin pages, and their TH counterparts (52 files; 69 pages already use the shared `analytics-env.js` loader).

This is pre-existing: the earlier consent-mode standardization covered the three product templates plus the homepages, not these pages. Closing it means converting the inline GTM block to `analytics-env.js` + `__mildmateInitAnalytics` on 52 pages. I have **not** done that, since it extends beyond the approved scope for this workstream.

## Changed-file manifest

This workstream:
- `public/js/cookie-consent.js`

Carried from the earlier approved Phases 1–5 (still uncommitted in the same working tree):
- `templates/product-marine.html`, `templates/product-customizable.html`, `templates/product-fixed.html`
- `functions/_middleware.ts`, `functions/product/[[path]].ts`, `public/_worker.js`
- `public/sitemap.xml`
- 31 EN + 31 TH generated product pages under `public/product/**` and `public/th/product/**`
- 11 TH listing pages (`public/th/{accessories,boarding-dorm,deep-pocket,duvet-covers,family,marine,pets,pillowcases,protection,rv-truck,sheets}/index.html`)
- `public/product/weighted-duvet-cover/index.html`

Not touched and not to be committed: the pre-existing working-tree changes under `00_Issue/ga4-lead-acquisition-20261101/` and `00_Issue/history-fix-note.md`.

## Rollback

1. `git restore public/js/cookie-consent.js` (single-file revert of this workstream).
2. Redeploy the prior preview build `https://d62a03f4.mildmate-new.pages.dev` if a preview rollback is wanted.
3. No production deployment occurred, so production needs no rollback.

## Items still awaiting owner signoff

- Claim-sensitive Thai strings from the Phase 3 metadata fix:
  - `ปลอกผ้านวมแบบซิป 3 ด้าน - เปลี่ยนง่ายใน 60 วินาที`
  - `ผ้ารองกันเปื้อนที่นอน - กันน้ำ 100% และกันไรฝุ่น`
- Decision on closing the 52-page inline-GTM consent gap.
- Decision on a separate fix pass for the intermittent TH mobile homepage layout shift.
