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

## 3) Super-admin sidebar Unauthorized (Blog + Reviews)

### Symptom
- On `https://www.mildmate.com/super-admin/`, sidebar modules showed:
  - `Failed to load posts: Unauthorized`
  - `Failed to load reviews: Unauthorized`

### Root cause
- Sidebar modules call admin APIs using auth headers from Clerk token.
- Clerk init logic treated only `/account`, `/admin`, `/quote` as auth-critical, so `/super-admin/` could fetch before token was ready.

### Fix applied
- Updated `public/js/clerk.js` auth-critical path detection to include:
  - `/super-admin`
- Hardened `window.getClerkToken()` to initialize/wait for Clerk on auth-critical paths before requesting session token.
- This covers both Blog and Reviews sidebar modules because both use the same authenticated header flow.

## 4) Reviews data + rendering fixes (post go-live)

### Symptoms
- Production had empty reviews while preview still had historical reviews.
- Review images were broken on product pages/homepage.
- Some EN review text showed mojibake (for example `IΓÇÖm`, `160├ù50`).
- A deployment looked successful but still served old API behavior.

### Root causes
- Reviews existed in old/preview D1 but not production D1.
- Image paths stored as `/r2/...` were blocked/challenged on production host paths.
- Legacy imported text contained encoding artifacts.
- Pages Functions build output was generated to `public/index.js`, while deploy relied on `public/_worker.js` (stale bundle risk).

### Fix applied
- Migrated all reviews from preview D1 to production D1 (45 rows).
- Updated review API responses to convert `/r2/...` image paths to public `https://*.r2.dev/...` URLs.
- Added server-side mojibake normalization for review text/name/country in review endpoints.
- Ensured worker artifact sync before deploy:
  - `npx wrangler pages functions build --outdir public`
  - copy `public/index.js` -> `public/_worker.js` before `wrangler pages deploy public`

### Verification
- Production and preview review counts aligned at 45 rows after migration.
- Product review cards can load images again after URL normalization.
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
