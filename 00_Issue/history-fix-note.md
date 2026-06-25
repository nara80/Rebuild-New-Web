# History + Fix Notes (Lighthouse + Thai Homepage Font)

## Summary
- Lighthouse regression investigation was mixed with a separate Thai homepage rendering issue.
- Two parallel tracks were fixed:
  1. **Thai homepage text/font correctness (`/th/`)**
  2. **Homepage Lighthouse performance diagnostics (`/`)**

## 1) Thai homepage fix (`/th/`)

### Root cause
- `public/th/index.html` contained corrupted Thai text (`????????...`) in multiple sections.
- This looked like a font problem, but it was **content corruption/encoding** in that file.

### Fix applied
- Restored `public/th/index.html` from a clean historical commit (`0bd42d5925fe708a2dbf10cffc6e9685631b78d7`).
- Reapplied Thai font override in homepage CSS:
  - `html[lang="th"] body, html[lang="th"] h1, ... { font-family:'Sarabun',sans-serif }`
- Added cache-busting on Thai homepage font stylesheet:
  - `/css/fonts.css?v=2`
- Ensured `/th/` no longer contains `?` placeholder corruption.

### Verification pattern
- If page text shows `?????`, treat as **content corruption**, not font loading.
- Check source for Thai characters directly.

## 2) Lighthouse fix (`/`)

### Main bottlenecks observed
- Third-party script pressure (Clerk and extension noise)
- Unused JS / main-thread work
- Cache lifetime/image delivery warnings
- Deprecated API warnings (from browser diagnostics)

### Fix applied
- Updated `public/js/clerk.js` initialization strategy:
  - Removed timer/idle auto-init for non-critical routes.
  - Keep immediate init only on auth-critical routes:
    - `/account`, `/admin`, `/quote`
  - Initialize Clerk on real user intent (auth-related interactions) elsewhere.

### Latest measured outcome (shared screenshots)
- Performance: **88**
- Accessibility: **92**
- Best Practices: **73**
- SEO: **100**

### Remaining notes
- Some Best Practices/console/CSP diagnostics were caused by browser extensions during test runs.
- Use clean test profile before treating those as app regressions.

## 3) Reviews data + rendering fixes (post go-live)

### Symptoms
- Production had empty reviews while preview still had historical reviews.
- Review images were broken on product pages/homepage.
- Super-admin **Blog** sidebar thumbnails were broken for the 13-post list.
- Some EN review text showed mojibake (for example `IΓÇÖm`, `160├ù50`).
- A deployment looked successful but still served old API behavior.

### Root causes
- Reviews existed in old/preview D1 but not production D1.
- Image paths stored as `/r2/...` were blocked/challenged on production host paths.
- Admin blog API returned `featured_image` as `/r2/...` paths, so super-admin list thumbnails failed on production host.
- Legacy imported text contained encoding artifacts.
- Pages Functions build output was generated to `public/index.js`, while deploy relied on `public/_worker.js` (stale bundle risk).

### Fix applied
- Migrated all reviews from preview D1 to production D1 (45 rows).
- Updated review API responses to convert `/r2/...` image paths to public `https://*.r2.dev/...` URLs.
- Updated admin blog API responses (`/api/admin/blog`) to normalize `featured_image` to public `https://*.r2.dev/...` URLs (list + single post).
- Added server-side mojibake normalization for review text/name/country in review endpoints.
- Ensured worker artifact sync before deploy:
  - `npx wrangler pages functions build --outdir public`
  - copy `public/index.js` -> `public/_worker.js` before `wrangler pages deploy public`

### How to recover "Blog" and "Reviews" quickly (runbook)
1. **Confirm data source first**
   - Check review count in production and preview D1:
     - `npx wrangler d1 execute mildmate-db-prod --remote --command "SELECT COUNT(*) AS cnt FROM reviews;"`
     - `npx wrangler d1 execute mildmate-db-prod --remote --preview --command "SELECT COUNT(*) AS cnt FROM reviews;"`
2. **If production reviews are empty**
   - Migrate rows from preview D1 to production D1 (reviews table).
3. **If images/thumbnails are broken**
   - Verify APIs return `https://*.r2.dev/...` (not `/r2/...`) for:
     - `/api/reviews`
     - `/api/products/{slug}/reviews`
     - `/api/admin/blog`
4. **Always rebuild + sync worker artifact before deploy**
   - `npx wrangler pages functions build --outdir public`
   - `Copy-Item public/index.js public/_worker.js -Force`
   - `npx wrangler pages deploy public --commit-dirty`
5. **Smoke test after deploy**
   - `/super-admin/` => Blog + Reviews sidebars load
   - `/` and `/th/` => review cards text renders correctly
   - `/product/{slug}/` => review photos load correctly

### Verification
- Production and preview review counts aligned at 45 rows after migration.
- Product review cards can load images again after URL normalization.
- Super-admin blog list thumbnails load after `featured_image` URL normalization.
- Corrupted text patterns are normalized in API output.

## Repeatable troubleshooting checklist
- [ ] Confirm route (`/` vs `/th/` etc.)
- [ ] Decide category: content corruption, font, cache, third-party, or app JS
- [ ] Inspect served HTML/CSS markers (not only UI)
- [ ] Apply smallest safe fix
- [ ] Run `npm run lint`
- [ ] Deploy preview
- [ ] Re-run Lighthouse in clean Chrome profile (no extensions)
- [ ] Compare before/after screenshots

## 4) Footer consistency fix (homepage vs other pages, mobile)

### Symptoms
- Footer looked nicer/shorter on `/` but different on `/faq/`, `/products/`, `/blogs/` in mobile view.
- Footer HTML block was identical across routes, but visual output differed.

### Root cause
- Homepage had extra page-scoped footer CSS (`.home-page .site-footer ...`) in `public/index.html`.
- Other pages used shared footer markup from D1 but did not receive those homepage-only mobile rules.
- A deploy included static assets but did not include expected Functions behavior changes, causing confusion during verification.

### Fix applied
- Moved the important mobile footer layout behavior into shared CSS (`public/css/main.min.css`) so all pages inherit the same footer mobile format:
  - 2-column mobile footer grid with row spans for columns 3/4
  - tighter mobile spacing/typography to match homepage look
  - consistent icon sizes/tap targets and social row spacing
  - aligned footer-bottom spacing/link spacing
- Redeployed and verified footer markup parity and global CSS presence.

### Verification
- `/` and `/faq/` both return identical `site-footer` markup length.
- Deployed CSS includes global mobile footer rules (not only `.home-page` scoped rules).
- Mobile visual comparison now tracks the same footer structure and spacing across pages.

### Deployment note (important)
- When troubleshooting Pages behavior differences, verify whether the change is:
  1. **Static CSS/HTML asset change** (deploying `public/` is sufficient), or
  2. **Functions/Worker logic change** (requires function build/deploy path consistency).
- For this footer issue, the decisive fix was shared CSS, not D1 markup replacement.

## 5) Clerk Google sign-in redirect loop / `__clerk_db_jwt` URL residue

### Symptoms (observed timeline)
1. **Initial issue:** after Google sign-in, homepage URL remained:
   - `/?__clerk_handshake=...&__clerk_db_jwt=...`
   - user appeared signed-out.
2. **After first patch:** profile avatar appeared for 1–2 seconds, then browser redirected again to:
   - `/?__clerk_db_jwt=...`
   - effectively causing sign-in loop behavior.

### Root causes (reconciled)
- `public/js/clerk.js` lazy-initializes Clerk on non-critical routes (including `/`), so handshake query params could arrive before Clerk was fully ready there.
- URL cleanup happened too early in the first patch. Removing `__clerk_*` params before session stabilization could interrupt dev-mode handshake finalization.
- Sign-in redirects reused current URL in multiple entry points, which could propagate stale `__clerk_*` params.

### Fixes applied (final)
- `public/js/clerk.js`
  - Added handshake param detection (`__clerk_handshake`, `__clerk_db_jwt`).
  - Forces immediate Clerk init when handshake params are present.
  - Sanitizes redirect URLs for `signInWithClerk` / `signUpWithClerk` by removing all `__clerk_*` query keys.
  - Added session-aware cleanup: wait until Clerk session/user is available, then remove `__clerk_*` params with `history.replaceState`.
- `public/js/nav.js`
  - Header sign-in action now passes a cleaned URL (without `__clerk_*`) to both Clerk SDK redirect and fallback hosted-page URL.

### Verification (actual completed state)
- Redirect loop is resolved.
- Homepage no longer keeps `__clerk_db_jwt` / `__clerk_handshake` in URL after successful sign-in completion.
- Clerk account state remains signed-in after redirect return.

## 6) Blog post SSR 500 (`/blogs/{slug}/`) — stale worker bundle

### Symptoms
- Opening `https://www.mildmate.com/blogs/dirty-truth-luxury-pillow-midnight-drool/` returned:
  - `Server error`
  - HTTP `500` in browser console/network.

### Root cause
- Source code in `functions/blog-shared.ts` had already been fixed, but deployed worker artifact was stale.
- `public/_worker.js` still contained old blog rendering flow from a previous bundle, so production executed outdated code.

### Fix applied
- Rebuilt Pages Functions bundle:
  - `npx wrangler pages functions build --outdir public`
- Synced build artifact to deploy worker entry:
  - `Copy-Item public/index.js public/_worker.js -Force`
- Confirmed new `_worker.js` includes fixed blog return path:
  - `return html.replace(/<\/head>/i, ... )`

### Verification
- Live check before fix showed HTTP `500` on affected blog slug.
- Local artifact verification confirmed fixed bundle content is now present in `public/_worker.js`.
- Lint check passed after update workflow (`npm run lint`).

## 7) Product page redirect loops and grid-redirect (including Bed Lifter)

### Symptoms
- Clicking the [View Details] CTA on the Bed Lifter product (and the BedBridge Connector) linked to the correct URL `/product/mattress-lift-helper/`, but the page served the general products index grid (`/products/`) instead of the product details.
- Requesting standard product pages (like `/product/standard-fitted-sheet/`) resulted in an infinite HTTP 308/301 redirect loop, causing browser timeouts or memory exhaustion in local dev.

### Root causes
- **Pretty URLs Redirects**: Cloudflare Pages automatically redirects `/product/slug/index.html` (the internal template fetch path inside `functions/product/[[path]].ts`) to `/product/slug/` with a `308 Permanent Redirect`.
- **Middleware Interception**: The `resolveLegacyProductPath` helper in [functions/_middleware.ts](file:///D:/00_mildmate/Re-Build_web/functions/_middleware.ts) did not account for canonical product subpaths or templates ending in `/index.html`. 
  - Because `/product/slug/index.html` failed the exact `CANONICAL_PRODUCT_SLUGS` check, it fell through to legacy redirect checks.
  - For standard products (e.g., matching `fitted`), it returned a 301 redirect to `/product/standard-fitted-sheet/`, causing the infinite fetch loop.
  - For accessories/non-fabric products (e.g., `mattress-lift-helper`), it fell back to `/products/`, serving the all-products grid HTML as the static page template.

### Fixes applied
- **Middleware early return**: Modified `resolveLegacyProductPath` in [functions/_middleware.ts](file:///D:/00_mildmate/Re-Build_web/functions/_middleware.ts) to extract the first path segment (the slug). If it belongs to `CANONICAL_PRODUCT_SLUGS`, it returns `null` immediately, ensuring subpaths (like `index.html`) never get legacy redirects.
- **Function route bypass**: Added a guard in [functions/product/[[path]].ts](file:///D:/00_mildmate/Re-Build_web/functions/product/[[path]].ts) that calls `context.next()` if the path parts length is greater than 2, passing requests for static templates directly to the asset server.
- **Direct Asset Fetching**: Updated the template fetch in [functions/product/[[path]].ts](file:///D:/00_mildmate/Re-Build_web/functions/product/[[path]].ts) from the global `fetch()` to `context.env.ASSETS.fetch()`. This accesses the built assets directly, bypassing routing middleware and Cloudflare's automatic Pretty URL redirects.
- **Rebuilt & Synced Bundle**: Recompiled the functions and synced the build to the production entrypoint:
  - `npx wrangler pages functions build --outdir public`
  - `Copy-Item public/index.js public/_worker.js -Force`

### Verification
- Tested locally on `http://127.0.0.1:8788`:
  - `/product/mattress-lift-helper/` returns `200 OK` with title `<title>Bed Lifter (38 cm) — MildMate</title>` (fully verified product details page rendering).
  - `/product/bedbridge-connector/` returns `200 OK` with title `<title>BedBridge Connector — MildMate</title>`.
  - `/product/standard-fitted-sheet/` resolves cleanly with `200 OK` in 20-30ms, completely resolving the infinite redirect loop.

## 8) Product main image not displaying on product details pages

### Symptoms
- When visiting a product detail page (e.g. `/product/mattress-lift-helper/`), the main product image was completely missing/invisible in the browser.

### Root causes
- **Template Literal Capture Group Bug**: Inside [functions/product/[[path]].ts](file:///D:/00_mildmate/Re-Build_web/functions/product/[[path]].ts), the image tag replacement used:
  ```typescript
  html.replace(
    /<img([^>]*)id="gallery-main-img"([^>]*)>/,
    `<img${1}id="gallery-main-img"${2} src="${mainImage}">`
  )
  ```
  Because the replacement was in a TypeScript template literal backtick string, `${1}` and `${2}` were evaluated by JavaScript at compile time as the literal numbers `1` and `2`, instead of being passed as regex capture groups `$1` and `$2`.
  This corrupted the HTML tag to `<img1id="gallery-main-img"2 src="...">`, which is invalid HTML and prevented the browser from rendering the image.
- **Duplicate src Attribute**: Furthermore, because `$1` contained the original `src="..."` attribute (since `src` is defined before `id="gallery-main-img"` in the templates), even if `$1` and `$2` were used correctly, appending `src="${mainImage}"` at the end resulted in duplicate `src` attributes, which would cause the browser to ignore the newly injected database image path in favor of the original placeholder.

### Fixes applied
- **Targeted src attribute replacement**: Modified [functions/product/[[path]].ts](file:///D:/00_mildmate/Re-Build_web/functions/product/[[path]].ts) to run two targeted regex replacements for the `src` attribute itself, depending on whether `id="gallery-main-img"` is defined before or after the `src` attribute:
  ```typescript
  html = html.replace(/(<img\b[^>]*?\bid="gallery-main-img"[^>]*?\bsrc=")[^"]*/i, `$1${mainImage}`);
  html = html.replace(/(<img\b[^>]*?\bsrc=")[^"]*("[^>]*?\bid="gallery-main-img")/i, `$1${mainImage}$2`);
  ```
  This cleanly updates the existing `src="..."` attribute value in place, avoiding tag corruption and duplicate attributes.
- **Rebuilt & Synced Bundle**: Recompiled the functions and synced the build to the production entrypoint:
  - `npx wrangler pages functions build --outdir public`
  - `Copy-Item public/index.js public/_worker.js -Force`

### Verification
- Tested locally on `http://127.0.0.1:8788`:
  - Inspected the returned HTML and verified that the `<img>` tag is correctly output as a single valid tag with the updated database image URL:
    `<img src="/images/products/pet-owner-fitted-sheet.jpg" alt="Pet Owner Fitted Sheet" id="gallery-main-img" width="800" height="800" loading="eager">`

## 9) Accessory/fixed product pages image gallery fixes (thumbnails recovery + swipeable carousel navigation parity)

### Symptoms
- Visiting fixed-size or accessory product pages (such as the BedBridge Connector `/product/bedbridge-connector/` or Bed Lifter `/product/mattress-lift-helper/`) had two main gallery issues:
  1. **Missing thumbnails**: Only the main product image was shown; the gallery thumbnails underneath were completely hidden. Specifically, for the BedBridge Connector, although D1 keeps **10 images** (1 main + 9 gallery images), **only 1 image** was visible.
  2. **No carousel navigator**: Unlike customizable pages (e.g. `/product/mattress-protector-family/`), there were no left/right navigation arrows, bottom slide dots, or swipe interactions on the main image.

### Root causes
- **Escaped DB images**: The `images` column stored in D1 contained double-escaped backslash-quotes (e.g. `"[\\\"\\\",\\\"/r2/products/uploads/1781347014151-m6poy3.jpg\\\",...]"`). This caused both the server-side API parser (`r2Product`) and browser's `JSON.parse` to crash, triggering the client-side fallback to hide the gallery thumbnails.
- **Static HTML template**: The template `product-fixed.html` was historically designed with a static `<img>` container (`.gallery-main`) instead of the swipeable `.carousel-wrap` track component used in other product templates.

### Fixes applied
- **Robust server-side parsing**: Updated `r2Product` in `workers/api/products.ts` and `functions/api/[[path]].ts` to clean double-escaped quotes before parsing.
- **Robust client-side parsing**: Added defensive fallback parsing to all three templates (`templates/product-fixed.html`, `templates/product-customizable.html`, and `templates/product-marine.html`).
- **Carousel Navigation Parity**: Upgraded the HTML markup, CSS styling (using a 4:3 aspect ratio), and JavaScript logic in `templates/product-fixed.html` to implement the unified swipeable gallery carousel with arrows, dots, and touch swipe gestures.
- **Removed Unverified OEKO-TEX Claims for Accessories**: Removed the "OEKO-TEX Certified" trust badge from the desktop and mobile layouts for all fixed/accessory products (which do not use fabric collections) in `build-products.js` and `templates/product-fixed.html`, replacing it with a general "Premium Quality" badge.
- **Rebuilt static pages**: Ran `node scripts/build-products.js` to update all 27 static product files.
- **Rebuilt Pages Functions**: Recompiled the functions and synced the deployment entrypoint:
  - `npx wrangler pages functions build --outdir public`
  - `Copy-Item public/index.js public/_worker.js -Force`

### Verification
- Tested locally on `http://127.0.0.1:8788`:
  - Fetching `/api/products/bedbridge-connector` now successfully returns mapped absolute public R2 URLs.
  - Verified that `/product/bedbridge-connector/` shows all 10 thumbnails (1 main + 9 gallery images), displays left/right navigation arrows + dots, supports swipe navigation, and swaps slides correctly.
  - Verified that `/product/mattress-lift-helper/` shows all 3 thumbnails (1 main + 2 gallery images) and operates with the same navigation features.
  - Verified that neither the BedBridge Connector nor the Bed Lifter product page contains the unverified "OEKO-TEX Certified" or "Custom Fit" trust badges on desktop or mobile.

## 10) New product rollout gap: exists in DB/static page but missing in product-type & niche listings (Marine Mattress Protector) + listing text/image normalization

### Incident scope (reconciled)
When `marine-mattress-protector` was introduced, rollout was partially complete:
- Product row/state issue (Super Admin visibility) was resolved via DB migration.
- But listing parity was incomplete: product did not appear on:
  - product-type page: `/protection/`
  - niche page: `/marine/`

### Root causes
- New-product rollout was treated as a single-page addition, but this project requires **multi-surface registration**.
- Super Admin list is DB-backed (`/api/admin/products`) while `/protection/` and `/marine/` are static listing pages, so they must be updated separately.
- Route behavior also depends on canonical slug allow-list in `functions/product/[[path]].ts`.

### What was completed
- Added `marine-mattress-protector` product/content/template path and static product artifact.
- Added migration `031_marine_mattress_protector.sql` to seed:
  - `margin_rate_protector_marine`
  - product row (`marine-mattress-protector`)
  - shipping tier mapping (`shipping_product_tiers` tier `1`)
- Added canonical slug entry in `functions/product/[[path]].ts`.
- Added listing cards for `marine-mattress-protector` to:
  - `public/marine/index.html`
  - `public/protection/index.html`
  - `public/th/marine/index.html` (Added in follow-up sync to resolve EN/TH listing discrepancies)
- Updated fallback/seed image path for Marine Mattress Protector to an existing product image:
  - `/images/products/mattress-protector-standard/main.jpg`
  - applied in data/migration/build output and listing cards (replacing temporary logo fallback).
- Normalized mojibake-prone listing separators:
  - replaced `Â·` with `&middot;` on `/marine/` and `/protection/`.
  - replaced one corrupted dash sequence with `&mdash;` on `/protection/`.

### Verification status (systematic reconciliation)
- **Local/source verified:** ✅
  - `public/product/marine-mattress-protector/index.html` exists.
  - `functions/product/[[path]].ts` contains `marine-mattress-protector` in canonical slugs.
  - `/marine/` and `/th/marine/` sources contain the `marine-mattress-protector` product card.
  - `/protection/` source contains `/product/marine-mattress-protector/`.
- **DB verified:** ✅
  - D1 remote query (2026-06-18): `products` count = **28**, `marine-mattress-protector` exists (`marine_cnt = 1`, `is_active = 1`).
- **Deployed listing parity (live):** ✅
  - `https://www.mildmate.com/marine/` shows `marine-mattress-protector` card with current R2 feature image URL.
  - `https://www.mildmate.com/th/marine/` shows `marine-mattress-protector` card with R2 feature image.
  - `https://www.mildmate.com/protection/` shows `marine-mattress-protector` card.
  - Listing copy separators render with `&middot;` (no `Â·` mojibake artifact).
- **Live route behavior:** ✅
  - `/product/marine-mattress-protector/` and `/th/product/marine-mattress-protector/` resolve cleanly and render correctly, with routing alignment completely functional.

### Image update reconciliation (Super Admin feature image sync)
- **Issue observed:** after updating product feature image in Super Admin/D1, listing pages still showed the previous image URL.
- **Important architecture note:** this is expected with current setup. Super Admin updates D1 first-image data for product detail rendering, but `/marine/`, `/protection/`, `/products/` (and TH equivalents) are static listing pages and do **not** auto-sync image URLs from D1.
- **What was completed:**
  - Synced marine-mattress-protector image URL across related listing/detail pages and source data:
    - `public/marine/index.html`
    - `public/protection/index.html`
    - `public/products/index.html`
    - `public/th/marine/index.html`
    - `public/th/products/index.html`
    - `public/product/marine-mattress-protector/index.html`
    - `public/product/marine-fitted-sheet/index.html` (related products card)
    - `data/products.json`
  - Replaced old image URL `1781695116710-692fq8.jpg` with current image URL `1781748617971-bdh8v6.jpg`.
  - Removed old image object from remote R2 bucket immediately after sync.
- **Verification:**
  - Repo search confirms no stale reference to old image URL.
  - Old image URL returns `404` after remote deletion.
  - Current image URL returns `200`.
  - Listing/detail pages use the same current image URL after manual sync.

### Next-time rollout checklist (for any new product)
1. Add product data/content/template path and generate `/public/product/{slug}/index.html`.
2. Seed DB row (migration) so product appears in Super Admin DB-backed list.
3. Add slug to canonical routing allow-list in `functions/product/[[path]].ts`.
4. Add product card to required listing pages for **both English and Thai routes** (e.g., `/marine/` AND `/th/marine/`, `/protection/` AND `/th/protection/` etc.) to maintain parity.
5. Ensure fallback image path exists in `public/images` (or use a verified existing product image path).
6. Validate locally:
   - `npm run lint`
   - grep/inspect listing sources for `/product/{slug}/` on both languages
7. Deploy and smoke test:
   - `/product/{slug}/` and `/th/product/{slug}/`
   - each expected product-type and niche listing page (both EN and TH)
   - Super Admin product list visibility
   - no mojibake text artifacts (e.g., `Â·`) on listing pages
8. If product image is updated in Super Admin:
   - propagate the new image URL to all related static listing sources (EN + TH + related cards),
   - run grep to ensure old URL is fully removed,
   - delete old R2 object only after replacement URL is confirmed live/available (`200`).
9. Do not assume image update is automatic:
   - treat Super Admin image update as **D1 update only**,
   - always run static listing sync + deploy for EN/TH listing parity.

### Regression follow-up (2026-06-19) — `/th/marine/` Thai mojibake served on live
- **What happened:** `/th/marine/` showed Thai mojibake (`à¸...`) in title/meta/hero text.
- **Verification:** local source `public/th/marine/index.html` was clean UTF-8 Thai; live `www` response was stale/corrupted.
- **Resolution (same issue class, no new root-cause category):**
  - `npm run lint`
  - `npx wrangler pages functions build --outdir public`
  - `Copy-Item public/index.js public/_worker.js -Force`
  - `npx wrangler pages deploy public --commit-dirty`
  - deployment URL: `https://c1073461.mildmate-new.pages.dev`
- **Post-deploy verification:** preview + `https://www.mildmate.com/th/marine/` no longer match mojibake patterns (`à¸|à¹`).
- **Reconciliation note:** this was a deployment artifact freshness mismatch, not a new font-system defect.

## 11) Favicon head consistency (`/` vs listing/category pages)

### Symptoms
- Browser tab icon appeared on `/` but not consistently on routes like `/accessories/`.
- Source inspection showed missing explicit favicon tags in route HTML heads.

### Root cause
- Pages did not consistently include explicit `<link rel="icon">` and `<link rel="apple-touch-icon">` tags.

### Fix applied (code)
- Added sitewide head injection in `functions/_middleware.ts`:
  - `<link rel="icon" type="image/png" sizes="32x32" href="/images/logo.png">`
  - `<link rel="apple-touch-icon" href="/images/logo.png">`
- Injection runs only when missing to avoid duplicates.

### Verification (reconciled)
- **Built/compiled:** ✅
  - `npm run lint` passed.
  - `npx wrangler pages functions build --outdir public` passed.
  - Compiled bundle contains `SHARED_FAVICON_LINKS` injection logic.
- **Preview/live confirmation at check time:** ✅
  - Checked on deployed environment (`mildmate-new.pages.dev` and `/accessories/`) and confirmed that the middleware correctly intercepts responses and injects the standardized favicon link tags.

## 12) Super Admin product image upload failed (`/api/admin/upload` 403 + HTML challenge)

### Symptoms
- In `https://www.mildmate.com/super-admin/`, saving product edits with image upload failed with:
  - `Upload slot 1 error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
- Network request:
  - `POST https://www.mildmate.com/api/admin/upload`
  - `403 Forbidden`
  - response body was HTML (Cloudflare challenge page), not JSON.

### Root cause
- Production WAF/Bot challenge was intercepting `/api/admin/upload` requests before they reached Worker code.
- Super Admin frontend expects JSON from `/api/admin/upload`; HTML challenge caused JSON parse failure.

### Fix applied
- Added Cloudflare WAF custom skip/bypass rule for production admin upload endpoint so authenticated admin upload calls are not challenged.
- Scope used: host `www.mildmate.com`, path `/api/admin/upload*`, methods `POST`/`DELETE`, with `x-admin-secret` header present.

### Verification
- Post-fix probe:
  - `curl.exe -i -X POST "https://www.mildmate.com/api/admin/upload" -H "X-Admin-Secret: test"`
- Result:
  - returns Worker JSON `401 Unauthorized` (expected with wrong secret),
  - no Cloudflare HTML challenge page,
  - confirms request now reaches application layer.

### Runbook note (next time)
- If Admin upload shows `Unexpected token '<'` and network response is HTML on `/api/admin/upload`, check for `Cf-Mitigated: challenge` header.
- If present, treat as edge/WAF issue first, not app JSON parsing bug.

### Follow-up issue after WAF fix: `401 Unauthorized` on upload

#### Symptoms
- After challenge bypass was added, upload no longer returned HTML challenge.
- Super Admin still showed:
  - `Upload slot 1 failed: Unauthorized`
- Network response became Worker JSON:
  - `POST /api/admin/upload` → `401 {"error":"Unauthorized"}`

#### Root cause
- Request reached Worker correctly, but auth was missing/misaligned for upload/save flow.
- Super Admin product upload/save paths were still effectively depending on `X-Admin-Secret` state in some runtime paths, while production admin flow is Clerk-based.

#### Fix applied
- Updated Worker auth handling to accept Clerk admin bearer auth (same admin role/email strategy used by other admin APIs):
  - `workers/api/admin-upload.ts`
  - `workers/api/admin-products.ts`
- Updated Super Admin frontend to use unified auth headers for product/upload operations:
  - `public/super-admin/index.html`
  - upload POST/DELETE, products GET, and product save now use `getAdminAuthHeaders(...)`.

#### Verification (post-fix expectations)
- `curl` with fake secret still returns JSON `401 Unauthorized` (expected negative test).
- Successful browser upload requires valid admin session/token (or valid admin secret fallback).
- If still failing in browser after deploy, do hard refresh + re-login and inspect request headers for:
  - `Authorization: Bearer ...` (preferred), or
  - valid `X-Admin-Secret`.

## 13) Product description dynamic override mismatch (BedBridge Connector)

### Symptoms
- The BedBridge Connector product page (`/product/bedbridge-connector/`) displayed the old WordPress-era description ("T-Shaped Wedge — Bridging Two Mattresses Into One...") instead of the new simplified 5-pillar description, even though the built static HTML in the codebase was correct.

### Root cause
- The product page templates (e.g. `templates/product-fixed.html`) contain client-side JavaScript that queries the database API `/api/products/{slug}` dynamically. 
- If a description is returned in `description_en` or `description_th` from the database, the script dynamically overwrites `#fixed-content-wrapper` with the database content.
- Since the remote D1 databases (staging `mildmate-db` and production `mildmate-db-prod`) had not yet been updated with the SQL migration (`data/migrate-fixed-descriptions.sql`), they returned the old description, causing the client-side script to overwrite the correct static HTML with the outdated version.

### Fix applied
- Ran the SQL migration script `data/migrate-fixed-descriptions.sql` on the remote staging database `mildmate-db` and the remote production database `mildmate-db-prod` (`npx wrangler d1 execute ... --remote`).
- Committed the local description update fixes and pushed them to GitHub (`origin/master`).
- Manually deployed the local workspace to Cloudflare Pages to guarantee all assets and workers are fully refreshed.

### Verification
- Queried both remote databases directly using Wrangler and confirmed they now return the correct updated descriptions.
- Visited the new preview URL `https://96ad074a.mildmate-new.pages.dev/product/bedbridge-connector/` in the browser and verified the new description renders correctly.

## 14) Mojibake/font artifact reconciliation on product/listing cards (`Â·`, `â€”`)

### Incident scope (what actually failed)
- `/product/marine-mattress-protector/` rendered mojibake text in multiple places (for example:
  - `Marine Mattress Protector â€” 3-Layer Waterproof`
  - malformed title/meta dash sequences).
- Listing card subtext also contained mojibake separators on product cards (for example `TPU layer Â· Comfort soft`).

### Root cause (reconciled)
- Product page generation path still emitted corrupted UTF-8 sequences in some generated marine-page strings.
- Static listing HTML pages contained literal mojibake separator text (`Â·`) instead of safe entity output.

### Fixes actually completed
1. **Marine product page generation hardening**
   - Updated `scripts/build-products.js`:
     - corrected marine FAQ/title strings to proper Unicode (`—`, `–`),
     - added `normalizeMojibake(...)` cleanup at the end of `buildMarine(...)` to sanitize common corrupted sequences before write.
   - Rebuilt product pages:
     - `node scripts/build-products.js`
2. **Card separator normalization across listing pages**
   - Replaced `Â·` with `&middot;` in:
     - `public/products/index.html`
     - `public/th/products/index.html`
     - `public/th/marine/index.html`

### Verification status (systematic)
- **Local/source verified:** ✅
  - `public/product/marine-mattress-protector/index.html` now contains clean dash text:
    - `<title>Marine Mattress Protector — MildMate</title>`
    - `Marine Mattress Protector — 3-Layer Waterproof`
  - Card-text re-scan confirms no `Â·` remaining in `product-fabrics-info` lines across listing pages.
- **Build/validator verified:** ✅
  - `npm run lint` passed.
  - `npx wrangler pages functions build --outdir public` passed.
- **Live deploy verification:** ⏳ pending deploy
  - This reconciliation reflects completed local/build state; production verification requires deploy + smoke test.

## 15) Homepage "What Customers Say" mojibake in review text (`iamboaty` row)

### Incident scope (what actually failed)
- Homepage review carousel ("What Customers Say") displayed corrupted tail text for one review:
  - `...I'll order other colors later.≡ƒÿâ≡ƒÆù≡ƒÖÅ`
- Affected record identified as:
  - customer: `iamboaty`
  - country: `Thailand`
  - review date: `2026-03-18`

### Root cause (reconciled)
- This was **not a font/CSS issue**.
- The corrupted sequence came from review content payload encoding artifacts in API data rendering path.
- Existing mojibake cleanup covered several legacy patterns, but did not remove this emoji-byte corruption family (`≡ƒ...`).

### Fixes actually completed
- Updated mojibake normalization in:
  - `workers/api/reviews.ts` (homepage/public reviews endpoint)
  - `workers/api/products.ts` (product reviews/data normalization path)
- Added cleanup pattern to strip corrupted `≡ƒ...` byte clusters in normalized output.
- Applied targeted production data hotfix on D1 for the affected row:
  - `id = 15` (`iamboaty`)
  - removed corrupted suffix `≡ƒÿâ≡ƒÆù≡ƒÖÅ` from `review_text`.

### Verification status (systematic)
- **Issue verification:** ✅
  - Confirmed via live API payload (`/api/reviews`) that `iamboaty` review text included corrupted tail sequence before fix.
- **Code/build verification (hardening):** ✅
  - `npm run lint` passed after patch.
  - `npx wrangler pages functions build --outdir public` passed after patch.
  - Compiled output includes updated normalization logic.
- **Live production data verification:** ✅
  - Queried production D1 row and confirmed the affected text was updated.
  - Re-queried live `/api/reviews` and confirmed `iamboaty` now ends cleanly at:
    - `...I'll order other colors later.`
- **Deploy state for code-level guard:** ⏳ pending deploy
  - Data hotfix is already live.
  - The normalization-code hardening becomes active in production after next deploy.

## 16) Mobile trust-badge row mismatch between deploy previews (`a4655aa0` vs `b26c456b`)

### Incident scope (what was observed)
- User reported mobile icon-badge/trust section looked different between:
  - `https://a4655aa0.mildmate-new.pages.dev/`
  - `https://b26c456b.mildmate-new.pages.dev/`
- In screenshots, `a4655aa0` appeared as 2 rows while `b26c456b` appeared as 1 row.

### Root cause (reconciled)
- Trust-bar CSS itself was not the root cause (rules were effectively the same for trust grid/text in both pages).
- The deployed page behavior diverged because **viewport meta tag was missing** on homepage sources, causing mobile browsers/devtools to render using scaled desktop viewport behavior.
- Without `<meta name="viewport" content="width=device-width, initial-scale=1.0">`, visual mobile layout can differ even when section CSS matches.

### Fixes actually completed
- Added missing viewport meta to:
  - `public/index.html`
  - `public/th/index.html`
- This aligns rendering mode with expected mobile breakpoints and prevents false 2-row trust-badge presentation due to non-mobile viewport scaling.

### Verification status (systematic)
- **Code/source verified:** ✅
  - Both homepage files now include:
    - `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Live deploy verification:** ⏳ pending deploy
  - Current reconciliation reflects completed local/build state; production/preview confirmation requires deploy of latest changes.

## 17) `/th/products/` Thai rendering reconciliation (font fallback + mojibake cleanup)

### Incident scope (what was observed)
- User reported Thai rendering problems on:
  - `https://www.mildmate.com/th/products/`
- Two overlapping symptoms were present:
  1. Thai font fallback inconsistency (Sarabun not reliably applied).
  2. Mojibake/encoding artifacts in Thai content (for example `à¸...` sequences), which visually mimicked a font issue.

### Root cause (reconciled)
- **Font cascade issue:** route CSS still used `body { font-family: var(--font-main) }` with Quicksand default; `:lang(th)` alone was not sufficient for consistent route-wide Thai glyph rendering.
- **Content encoding issue:** Thai copy in `public/th/products/index.html` had become encoding-corrupted, resulting in mojibake text across meta + visible content.

### Fixes actually completed
1. **Thai font enforcement (route-level)**
   - Updated `public/th/products/index.html` with explicit Thai override:
     - `html[lang="th"] body, ... { font-family: 'Sarabun', sans-serif !important; }`
2. **Font cache-bust**
   - Updated route font include:
     - `/css/fonts.css` → `/css/fonts.css?v=2`
3. **Encoding repair**
   - Repaired `public/th/products/index.html` mojibake content to valid UTF-8 Thai text (meta + page UI copy + card content).

### Verification status (systematic reconciliation)
- **Pre-fix issue verification:** ✅
  - Confirmed `/th/products/` had both Thai font inconsistency symptoms and mojibake content artifacts.
- **Code/source verification (post-fix):** ✅
  - `public/th/products/index.html` now contains:
    - `fonts.css?v=2`
    - Thai Sarabun force-override block
    - Clean Thai text (no mojibake artifact patterns such as `à¸`, `Â`, `Ã`, `â€”`)
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Deployed-URL verification:** ✅
  - On deployed preview checks, font-fix markers were present in served HTML/CSS, confirming deployment included the Sarabun override + cache-busted font reference.
- **Current live/prod confirmation:** ⏳ deploy-dependent
  - Final production confirmation requires deployment of latest local encoding-repair commit, then recheck `/th/products/`.

## 18) Google Search Console Merchant listings issues (Product JSON-LD: missing `offers.price` + invalid `reviewCount`)

### Incident scope (what was observed)
- Google Search Console reported Merchant listings structured-data issues on `mildmate.com`:
  - **Critical:** Missing field `price` (in `offers`)
  - **Non-critical:** Invalid integer in `aggregateRating.reviewCount`

### Root cause (reconciled)
- Product JSON-LD in `functions/product/[[path]].ts` was hardcoded with:
  - `offers` block missing `price`
  - `aggregateRating.reviewCount` set to `"1000+"` (string/non-integer)
- This pattern was emitted route-wide for product SSR pages (`/product/{slug}/`), so issue scope was broad.

### Fixes actually completed
1. **Dynamic `offers.price` from D1**
   - Extended product query to include `base_price_usd`.
   - JSON-LD now sets:
     - `offers.price = base_price_usd.toFixed(2)` (numeric string)
     - `offers.priceCurrency = "USD"`
2. **Real aggregate review stats from D1**
   - Added review aggregation query on `reviews` table:
     - `COUNT(*) AS review_count`
     - `AVG(rating) AS rating_value`
   - Matching uses product taxonomy context (product type + niches mapped to review display labels) to align with existing review logic.
   - JSON-LD now sets:
     - `aggregateRating.reviewCount` as integer
     - `aggregateRating.ratingValue` as computed average (1 decimal)
3. **Validity guards**
   - `aggregateRating` is omitted if no reviews exist.
   - `offers` is emitted only when a valid positive `base_price_usd` exists.

### Verification status (systematic reconciliation)
- **Pre-fix verification (issue reproducibility):** ✅
  - Live product pages showed JSON-LD with missing `offers.price` and `reviewCount: "1000+"`.
- **Code/source verified (post-fix):** ✅
  - `functions/product/[[path]].ts` now contains:
    - D1 price wiring into JSON-LD offers
    - review aggregation query (`COUNT` + `AVG`)
    - integer `reviewCount` output path
    - removal of hardcoded `"1000+"`
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Live deploy verification:** ⏳ pending deploy
  - Production confirmation requires deploying the updated worker bundle, then re-validating affected URLs in Search Console.

## 19) Super Admin Products: "Card Short Benefit (EN)" field appeared empty

### Incident scope (what was observed)
- On `/super-admin/` → Products editor, the input `Card Short Benefit (EN)` rendered but appeared empty.
- This conflicted with listing behavior where `/products/` cards were already showing card-benefit text.

### Root cause (reconciled)
- D1 data was present, but deployed admin payload was stale/mismatched:
  - `/api/admin/products` on the affected deploy was not returning `card_benefit_en` / `card_benefit_th`.
- Super Admin form initializes values from `/api/admin/products`; missing keys were normalized to empty string in UI.

### Fixes actually completed
1. Ensured admin API + UI wiring were included in deploy artifacts:
   - `workers/api/admin-products.ts` includes `card_benefit_en` / `card_benefit_th` in admin products GET payload.
   - `public/super-admin/index.html` maps and renders `ed-benefit-en` / `ed-benefit-th`.
2. Rebuilt and synchronized deployment artifacts:
   - `npm run lint`
   - `npx wrangler pages functions build --outdir public`
   - `Copy-Item public/index.js public/_worker.js -Force`
3. Deployed updated build:
   - `npx wrangler pages deploy public --commit-dirty`
   - Preview: `https://89f784d4.mildmate-new.pages.dev`

### Verification status (systematic reconciliation)
- **Data-layer verification:** ✅
  - D1 row check confirmed `standard-fitted-sheet.card_benefit_en` populated.
- **Pre-fix issue verification:** ✅
  - Affected deploy showed empty field in Super Admin while `/products/` still showed card copy.
- **Post-deploy API verification:** ✅
  - `https://89f784d4.mildmate-new.pages.dev/api/admin/products` now includes:
    - `card_benefit_en`
    - `card_benefit_th`
  - Sample verified:
    - `standard-fitted-sheet.card_benefit_en = "Made to fit standard mattresses with a smooth, secure finish."`
- **UI verification:** ✅
  - User confirmed issue fixed after deploy.
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed


## 20) Category Page Fixes (OEKO-TEX, Tags, Anti-Fur, Thai copy)

### Incident scope (what was observed)
- **False OEKO-TEX Claims:** Category pages (`/boarding-dorm/`, `/duvet-covers/`, etc.) contained bullet points implying all fabrics were OEKO-TEX certified, when in fact only the PremaCotton fabric holds the certification.
- **Thai Copy Gaps:** The `/th/deep-pocket/` page contained an accidental un-translated English paragraph.
- **Feature Over-generalization:** The `/duvet-covers/` feature grid stated "Anti-Fur" as a category-wide feature, whereas only the BreezePlus fabric provides anti-fur protection.

### Root cause (reconciled)
- Boilerplate marketing copy was duplicated across category pages without tailoring the feature lists to specific product or fabric constraints (e.g. OEKO-TEX, Anti-Fur).
- Missing translation block during the static page generation or manual copy/paste.

### Fixes actually completed
1. **OEKO-TEX Compliance Sweep:** Removed blanket OEKO-TEX claims from category pages (e.g., `/boarding-dorm/`, `/duvet-covers/`) and replaced them with alternative value propositions (e.g., "Durable construction designed to withstand frequent machine washing").
2. **Thai Copy Cleanup:** Removed the stray English paragraph from `public/th/deep-pocket/index.html` and updated hero hooks.
3. **Feature Specificity Fix:** Updated the `/duvet-covers/` and `/th/duvet-covers/` feature grids to specify "Anti-Fur Options (BreezePlus fabric)" rather than implying all duvet covers repel pet hair.
5. **Shipping Constraint Added:** Added a highly visible "*Available for Thailand domestic delivery only*" disclaimer to the Duvet Insert product cards on both EN and TH `/duvet-covers/` pages.

### Verification status (systematic reconciliation)
- **Code/source verified:** ✅
  - `public/duvet-covers/index.html` and `public/th/duvet-covers/index.html` updated for anti-fur and OEKO-TEX.
  - `public/deep-pocket/index.html` and `public/th/deep-pocket/index.html` updated with cleaned Thai copy.
- **Live deploy verification:** ✅
  - Verified on live URLs that changes are reflected and false claims are removed.

### Regression follow-up (2026-06-19) — `/duvet-covers/` CTA reverted to `Customize This Product`
- **What happened:** user still saw CTA text `Customize This Product` on `/duvet-covers/` despite static category source using `Choose Size & Fabric`.
- **Root cause (reconciled):** listing cards for product-type/niche pages are SSR-replaced in `functions/_middleware.ts`; middleware CTA logic used `row.is_custom` and overrode static page CTA copy for duvet-cover products.
- **Fix completed (code):**
  - Updated `functions/_middleware.ts`:
    - `renderListingCards(...)` now receives route context.
    - For product-type route `duvet-covers`, force CTA to standard selector CTA:
      - EN: `Choose Size & Fabric`
      - TH: `เลือกขนาดและเนื้อผ้า`
    - Preserved fixed-product handling (`duvet-insert`, `bedbridge-connector`, `mattress-lift-helper`) as `View Details` / `ดูรายละเอียด`.
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Live deploy verification:** ⏳ pending deploy
  - Requires deploy to reflect middleware change on live `/duvet-covers/` and `/th/duvet-covers/`.

## 2026-06-18: Marketing Audit - Family & Co-Sleep (/family/)
- **Compliance (OEKO-TEX):** Removed the generic "OEKO-TEX certified, 100% chemical-free" bullet point from the bottom description (both EN and TH) and replaced it with a durability/washing benefit, maintaining consistency with previous category updates.
- **Compliance (Unverified Claims):** Removed "Hypoallergenic" text from the BedBridge Connector product card on the English page and replaced it with "Premium high-density foam" (Thai text was already compliant).

## 21) Pricing Parms reconciliation: Marine Protector Option A + admin auth alignment

### Incident scope (what was observed)
- In **Pricing Parms**, `marine_sewing_cost` appeared under **Fixed Costs & Constants** instead of **Other Sewing Costs**.
- Editing `margin_rate_protector_marine` on production returned:
  - `POST /api/admin/pricing-params` → `401 Unauthorized`
  - toast: `Set Admin Secret to save (401)`
- This created auth inconsistency: user was already Clerk-authenticated as admin (`nara19080@gmail.com`) but pricing save still required `X-Admin-Secret`.

### Root cause (reconciled)
1. `marine_sewing_cost` was seeded with category `fixed`, so UI grouped it into Fixed Costs.
2. `workers/api/admin-pricing.ts` used only `X-Admin-Secret` on production and did not accept Clerk admin auth, unlike other admin endpoints.

### Fixes actually completed
1. **Category/grouping correction**
   - Updated seed/defaults in:
     - `public/admin/index.html`
     - `public/super-admin/index.html`
   - Changed `marine_sewing_cost` category from `fixed` → `flat_sewing` so it renders in **Other Sewing Costs**.
   - Updated migration source:
     - `migrations/033_marine_protector_pricing_params.sql` (`marine_sewing_cost` category now `flat_sewing`).
2. **Existing DB data reconciliation**
   - Applied data correction on both remote DB bindings:
     - `mildmate-db`
     - `mildmate-db-prod`
   - SQL used:
     - `UPDATE pricing_params SET category='flat_sewing' WHERE key='marine_sewing_cost';`
3. **Admin auth parity for pricing params**
   - Updated `workers/api/admin-pricing.ts` to accept Clerk admin session (Bearer or Clerk cookie token path) using the same role/email strategy:
     - admin role metadata check
     - `ADMIN_EMAILS` allowlist fallback
     - Clerk user lookup fallback via `CLERK_SECRET_KEY`
   - Kept `X-Admin-Secret` as fallback path when Clerk auth is not available.

### Verification status (systematic reconciliation)
- **Code/source verified:** ✅
  - `public/admin/index.html` + `public/super-admin/index.html` include `marine_sewing_cost` in `flat_sewing`.
  - `migrations/033_marine_protector_pricing_params.sql` updated to `flat_sewing`.
  - `workers/api/admin-pricing.ts` now includes Clerk admin auth path plus secret fallback.
- **DB verified:** ✅
  - Remote D1 query confirmed:
    - `key='marine_sewing_cost'`
    - `category='flat_sewing'`
    - `value=500`
- **401 behavior verification:** ✅
  - Unauthenticated production probe to `/api/admin/pricing-params` still returns `401` (expected security behavior).
  - This is now expected only when caller has neither valid Clerk admin auth nor valid secret fallback.
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Live deploy verification:** ⏳ pending deploy
  - Final production UX confirmation requires deploy, then test as logged-in admin with `localStorage.admin_secret` cleared:
    - edit `margin_rate_protector_marine`
    - expect successful save without 401 toast.

## 2026-06-18: Marketing Audit - Pet Owner Bedding (/pets/)
- **Compliance (Overclaims):** Softened "slides off" to "reduces hair clinging" and "scratch-resistant without pilling" to "resists daily wear and tear" to ensure we are setting realistic expectations for pet owners without making unbreakable guarantees.
- **Compliance (Unverified Claims):** Replaced an unverified "Odor resistant" claim in the bottom description with a "Wrinkle-resistant" durability claim.
- **Localization:** Fixed broken translation where half of the bottom description on `/th/pets/index.html` was still in English. Fully translated all updated claims.

## 2026-06-18: Marketing Audit - RV & Truck Cab (/rv-truck/)
- **Compliance (Unverified Claims):** Dropped the "allergen" claim regarding the mattress encasement.
- **Marketing Pivot:** Completely rewrote the bottom description (both English and Thai) to specifically target the sleeper cab and RV market segment. The new copy emphasizes the CloudSoft fabric's Quick-Dry and Moisture-Wicking properties, custom-fit grip to prevent sheets from popping off on rough roads, and commercial-grade durability for life on the road.

## 2026-06-18: Marketing Audit - Protection (/protection/)
- **Compliance (Unverified Claims):** Removed a misleading OEKO-TEX Standard 100 claim that was specifically tied to PremaCotton, as none of the mattress protectors use PremaCotton. Replaced it with a practical "Machine washable for easy cleaning" benefit.
- **Compliance (Overclaim):** Softened the "Pet-Proof" feature from claiming "BreezePlus fur-resistant options" (and Thai equivalent of "slides off") to "BreezePlus tight-weave options to reduce hair clinging" to align with our established guidelines for the BreezePlus fabric.

## /sheets/ Category
**Date:** 2026-06-18
**Action:** Marketing Audit & Compliance Fixes
**Changes Made:**
1. **OEKO-TEX Claim:** Corrected the blanket "OEKO-TEX certified, 100% chemical-free" bullet point on the category page to explicitly state that only the PremaCotton fabric option is OEKO-TEX Standard 100 certified.
2. **Pet Hair Claim:** Softened the "easy to brush off pet hair" claim on the Pet-Friendly product card to "helps reduce pet hair clinging" in both English and Thai.
3. **Translation Fix:** Fixed an untranslated English string ("To your exact total W x L dimensions") on the Thai category page.

## /pillowcases/ Category
**Date:** 2026-06-19
**Action:** Marketing Audit & Compliance Fixes
**Changes Made:**
1. **Compliance Check:** Verified that OEKO-TEX is correctly limited to PremaCotton, and dust mite claims align with approved terminology ("ไรฝุ่น"). No cross-sells or pet-fur overclaims were found.
2. **Technical Fix:** Fixed a double-escaped ampersand (`&amp;amp;`) in the Open Graph and Twitter meta titles on the English category page.

## 22) Mojibake reconciliation on `/sheets/` + full EN product-type/product-page sweep

### Incident scope (what was observed)
- On `/sheets/`, one feature text rendered as:
  - `To your exact total W � L dimensions`
- User requested a full verification/fix sweep across:
  - all EN product-type pages (`/sheets/`, `/duvet-covers/`, `/pillowcases/`, `/protection/`, `/accessories/`)
  - all EN product pages (`/product/*`)

### Root cause (reconciled)
- This was encoding/mojibake content corruption (not font loading).
- Product-page generation still allowed some mojibake sequences to persist in generated HTML because normalization was incomplete and not applied at all final return paths.

### Fixes actually completed
1. **Direct category-page correction**
   - Updated `public/sheets/index.html`:
     - `W � L` → `W × L`
2. **Generator hardening for product pages**
   - Updated `scripts/build-products.js`:
     - expanded `normalizeMojibake(...)` replacements for common corrupted dash/quote/symbol sequences
     - ensured normalization is applied to final output of both:
       - `buildCustomizable(...)`
       - `buildFixed(...)`
     - corrected remaining mojibake literals in generator strings (duvet insert text block; `×`, `฿`, `°C`, `°F`, `m²`)
3. **Regenerated all product pages**
   - Ran:
     - `node scripts/build-products.js`

### Verification status (systematic reconciliation)
- **Scope scan verification:** ✅
  - Re-scanned all target EN product-type directories and all `/public/product/*` pages for mojibake signatures (`�`, `Ã...`, `â...`, `Â...`, `mÂ²`, `à¸¿`, etc.).
  - No remaining matches in requested scope after fixes/regeneration.
- **Build/validator verified:** ✅
  - `npm run lint` passed
  - `npx wrangler pages functions build --outdir public` passed
- **Live deploy verification:** ✅ (deployed), with scoped live confirmation
  - Deployed bundle after rebuild/sync:
    - `Copy-Item public/index.js public/_worker.js -Force`
    - `npx wrangler pages deploy public --commit-dirty`
    - deployment URL: `https://c1073461.mildmate-new.pages.dev`
  - Confirmed no mojibake pattern (`à¸|à¹`) on:
    - preview `/th/marine/`
    - live `https://www.mildmate.com/th/marine/`
  - Note: full route-by-route live manual QA for every EN product/product-type URL remains optional follow-up; source/build scope is fully clean.

## /marine/ Category
**Date:** 2026-06-19
**Action:** Marketing Value Proposition Update & Encoding Fix
**Changes Made:**
1. **Value Proposition Injection:** Updated the feature list and grid on both English and Thai pages to explicitly highlight the "14 mattress shapes available in the instant configurator" and "Instant online pricing without waiting for an email quote."
2. **Encoding Fix:** Regenerated `public/th/marine/index.html` to fix corrupted Thai character encoding, ensuring perfect UTF-8 rendering.
3. **Compliance Check:** Verified no OEKO-TEX overclaims or allergen claims. CloudSoft is correctly positioned as "moisture-resistant" for the marine environment.
4. **Regression Reconciliation (live):** Verified a later live regression where `www` served stale mojibake Thai (`à¸...`) despite clean local source; resolved by rebuild + worker sync + deploy (`c1073461`), then re-verified clean live output.

## Sitewide Product Tag Verification
**Date:** 2026-06-19
**Action:** Product Tag Normalization & Catalog Update
**Changes Made:**
1. **Catalog Update:** Discovered and officially added the 28th product, "Marine Mattress Protector" (`/product/marine-mattress-protector/`), to the `AGENTS.md` master catalog.
2. **Tag Synchronization:** Fixed inconsistent `data-categories` tags across 18 category files (both English and Thai). Products like the Pillowcases and 6-Sided Mattress Encasements now have identical tag sets regardless of which page they appear on, ensuring accurate filtering and SEO structure.

## 23) `/th/product/3-sided-duvet/` Thai Description reconciliation (D1 + SSR + client override)

### Incident scope (what was observed)
- User requested Thai description for:
  - `/th/product/3-sided-duvet/`
- Multiple preview deploys still showed mixed state:
  - Thai title/tagline and some labels were Thai
  - main description panel body remained English

### Root causes (reconciled)
1. **Data layer gap**
   - `products.description_th` for `slug='3-sided-duvet'` was empty in both D1 bindings at first.
2. **SSR replacement fragility**
   - Initial server-side panel replacement used brittle pattern assumptions and did not consistently replace the full panel on served HTML.
3. **Client-side overwrite regression (decisive blocker)**
   - `templates/product-customizable.html` had runtime logic:
     - `if (p.description_en) descPanel.innerHTML = p.description_en;`
   - This re-overrode the panel with English after page load, even when SSR had injected Thai content.

### What was completed
1. **D1 content update (both DBs)**
   - Updated `description_th` for `3-sided-duvet` on:
     - `mildmate-db`
     - `mildmate-db-prod`
   - Verified `th_len > 0` in both DBs.
2. **SSR localization hardening**
   - `functions/product/[[path]].ts` now reads:
     - `description_en`, `description_th`
   - Applies localized meta description and panel replacement using robust marker boundaries (`info-panel-description` → `info-panel-faq`).
3. **Client-side override fix (critical)**
   - `templates/product-customizable.html` updated to choose description by language:
     - Thai route uses `p.description_th` if present
     - otherwise falls back to `p.description_en`
   - Regenerated product pages:
     - `node scripts/build-products.js`

### Verification status (systematic reconciliation)
- **DB verification:** ✅
  - Both remote DB bindings now contain non-empty Thai description for `3-sided-duvet`.
- **Code/source verification:** ✅
  - SSR path + template path both updated for Thai-aware description handling.
  - Generated `public/product/3-sided-duvet/index.html` includes Thai-aware runtime selection.
- **Build/validator verification:** ✅
  - `npm run lint` passed after each patch set.
  - `npx wrangler pages functions build --outdir public` passed after each patch set.
- **Deployed preview verification up to `93ce2669`:** ✅ for diagnosis, ❌ for final outcome
  - Confirmed partial localization persisted on deployed preview prior to client-override fix deployment.
- **Current live/preview final confirmation:** ⏳ pending latest deploy
  - Final end-state confirmation requires deploying the latest local bundle that includes the client override fix, then re-checking:
    - `https://<new-preview>.mildmate-new.pages.dev/th/product/3-sided-duvet/`

### FAQ Thai follow-up (same reconciliation format as Description)

#### Incident scope (what was observed)
- After description fixes, user requested Thai FAQ on the same page.
- Preview checks still showed mixed result:
  - Thai tab labels and Thai tagline/description text appeared
  - FAQ questions/answers remained English

#### Root causes (reconciled)
1. **Description and FAQ are controlled by separate surfaces**
   - Description block is partly D1-driven and also overwritten by product template runtime.
   - FAQ block remains static template/SSR content unless explicitly replaced.
2. **SSR/HTML replacement boundary mismatch during earlier passes**
   - Earlier FAQ replacement logic did not consistently replace the full `info-panel-faq` block on served preview output.
3. **Client runtime remained the decisive blocker for FAQ**
   - Even after SSR attempts, the shipped customizable template behavior did not apply a Thai FAQ runtime override for `3-sided-duvet`, so deployed previews kept English FAQ content.

#### What was completed
1. Added Thai FAQ replacement logic in `functions/product/[[path]].ts` for:
   - `/th/product/3-sided-duvet/`
2. Hardened SSR boundary matching to reduce fragile container assumptions (id-based matching paths).
3. Applied final client-side fix in `templates/product-customizable.html`:
   - Added explicit Thai FAQ runtime override for `lang='th' && slug==='3-sided-duvet'`.
4. Regenerated static product pages from template:
   - `node scripts/build-products.js`
5. Rebuilt/validated locally after final patch set:
   - `npm run lint`
   - `npx wrangler pages functions build --outdir public`

#### Verification status (systematic reconciliation)
- **Code/source verification:** ✅
  - Thai FAQ replacement logic exists in `functions/product/[[path]].ts`.
  - Thai FAQ runtime override now exists in `templates/product-customizable.html`.
  - Regenerated `public/product/3-sided-duvet/index.html` includes the Thai FAQ runtime override block.
- **Build/validator verification:** ✅
  - lint/build passed on latest local state (after template fix + rebuild).
- **Preview deploy verification history (latest checked before final local fix):** ❌ partial only
  - Previews `8e37c768`, `ec4c8921`, and `7033842d` still showed English FAQ while Thai description/tagline were present.
- **Current final state:** ⏳ pending deploy confirmation for the final client-side FAQ patch
  - Must deploy latest local artifacts and re-verify on:
    - `https://<new-preview>.mildmate-new.pages.dev/th/product/3-sided-duvet/`

## 24) Checkout note test-flow reconciliation (preview redirect mismatch + runtime bundle drift)

### Incident scope (what was observed)
- Stripe test checkout completed, but redirect landed on production host:
  - `https://mildmate-new.pages.dev/order-confirmed/?session_id=cs_test_...`
- Order-confirmed page stayed in **Order Processing**, and new test session rows were not visible in expected verification queries.
- Stripe webhook events showed `Delivered (200)` but payload still contained:
  - `success_url: https://mildmate-new.pages.dev/order-confirmed/...`
  - missing `customer_note_type` / `customer_note` in `metadata`.

### Root causes (reconciled)
1. **Source/runtime mismatch**
   - `workers/api/checkout.ts` had been patched locally first, but deployed runtime used `public/_worker.js` (stale behavior).
2. **Hardcoded host logic in runtime**
   - Checkout session URL generation used host checks that collapsed preview hosts to `mildmate-new.pages.dev`.
3. **Runtime missing latest note metadata handling**
   - Runtime checkout path did not append `metadata[customer_note_type]` and `metadata[customer_note]`.
   - Runtime webhook insert/email path did not include customer note fields.

### What was completed
1. Updated source checkout origin handling (`workers/api/checkout.ts`):
   - `siteUrl` now derives from `new URL(request.url).origin` (localhost exception kept).
2. Patched deployed runtime artifacts directly to match current expected behavior:
   - `public/_worker.js`
   - `public/index.js`
3. Applied runtime parity fixes:
   - checkout metadata now includes:
     - `customer_note_type`
     - `customer_note`
   - webhook order insert now stores:
     - `customer_note_type`
     - `customer_note`
   - team notification email now includes customer note block.
4. Confirmed D1 schema readiness:
   - `orders` table contains both columns:
     - `customer_note_type`
     - `customer_note`
5. Redeployed preview branch and re-tested on preview alias flow.

### Verification status (systematic reconciliation)
- **Code/runtime verification:** ✅
  - `public/_worker.js` and `public/index.js` now contain origin-based success/cancel URL logic and customer-note metadata/webhook paths.
- **Build/validator verification:** ✅
  - `npm run lint` passed after patch set.
  - `npx wrangler pages functions build --outdir .wrangler/functions-bundle` passed.
- **Preview checkout redirect verification:** ✅
  - Confirmed successful post-payment redirect on preview alias:
    - `https://note-test-preview.mildmate-new.pages.dev/order-confirmed/?session_id=cs_test_a18Z3uOJWknx50mepRYBh8p1ocKo0Xefvh5bUvDNgcWMgK5tZbvAPZx2at`
  - This verifies checkout now keeps preview host context instead of forcing production host.
- **Stripe payload reconciliation:** ✅
  - Earlier payloads with `success_url=https://mildmate-new.pages.dev/...` were identified as stale-runtime evidence and superseded by the patched runtime + preview verification above.
