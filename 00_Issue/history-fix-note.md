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
