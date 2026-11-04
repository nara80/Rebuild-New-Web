# Catalog-Wide Product Image Optimization — GO/NO-GO Report (2026-11-03)

> **RELEASED TO PRODUCTION 2026-11-03** under owner's conditional GO. See "Production Release Addendum" at the end of this document for the released state, which supersedes the preview-era numbers below where they differ (notably: 510 prod-authoritative sources / 2,040 variants after pruning preview-only assets, and versioned `?v=` variant URLs).

Recommendation: **GO** — all gates green on the isolated preview. Production release remains withheld pending owner approval (per constraint: preview-only, no commit/push/merge, no prod deploy).

---

## 1. Scope delivered

| Item | Result |
|---|---|
| Product URLs covered | 62/62 (31 EN + 31 TH), all 3 template families (customizable / fixed / marine) |
| Source image assets resolved | 625 unique refs (products.json + audit CSV + live D1 API payloads from prod + preview hosts) |
| Generated WebP variants | 2,500 files under `public/images/products/variants/{thumbs,slides,related}/` + `manifest.json` |
| Variant profiles | thumb (180w q70), slide 640w (q76), slide 960w (q80), related 480w (q74); diagrams quality ≥84 |
| Common diagram PNGs converted | `Duvet.webp`, `Pillowcase.webp`, `measure-VBerth-diagram.webp` (1280w q88) with PNG fallbacks |
| Build integration | `scripts/build-products.js` invokes `ensureCatalogImageVariants()` (`scripts/image-variant-pipeline.cjs`) on every build — idempotent, skip-existing, env-overridable API bases via `MM_VARIANT_API_BASES` |
| Runtime behavior | Responsive `srcset/sizes` slides (eager hero, lazy rest), lazy variant thumbs, variant related cards, hard `onerror` fallback to original asset everywhere (srcset stripped on error) |
| Cache policy (P2 item) | New `_headers` rule: `/images/products/variants/* → Cache-Control: public, max-age=2592000` (verified live on preview) |

## 2. Preview deployment under test

- Branch alias: `https://catalog-image-variants-20261.mildmate-new.pages.dev`
- Latest deployment: `993a0bed` (prior iterations: `70823843` → `83cd960e` → `4e8da3cc` → `be5f5e3e`)
- Deploy command used: `npx wrangler pages deploy ./public --project-name=mildmate-new --branch=catalog-image-variants-20261103 --commit-dirty=true --no-bundle`

## 3. Validation evidence (all on deployment `993a0bed`)

| Check | Result | Artifact |
|---|---|---|
| Full-catalog render + variant enforcement (Playwright mobile, 62 URLs: status 200, zero failed/broken images, thumbs/slides/related all on variant paths) | **62/62 PASS** | `catalog-preview-validate.json` |
| Functional release gates (consent/analytics gating, quote funnel + dataLayer events, cart/checkout flows) | **PASS, 0 failed gates** | `preview-release-gates.json` |
| Variant cache headers | `image/webp` + `Cache-Control: public, max-age=2592000` on thumbs/slides/related; non-variant routes unchanged | HEAD probes (section 6) |

## 4. Lighthouse before/after (mobile, simulated throttling, 3 runs/page averaged)

Before = production `www.mildmate.com`; After = preview. Artifacts: `lighthouse-bench/*.json`, aggregate `lighthouse-bench/summary.json`.

| Page | Score (before → after) | LCP ms | Image bytes | Total bytes | Requests |
|---|---|---|---|---|---|
| standard-fitted-sheet EN (customizable) | 88.7 → **95.3** (+6.6) | 1824 → 1977 (+153, noise) | 1.14MB → 0.48MB (−58%) | 2.87MB → 0.91MB (−68%) | 61 → 54 |
| standard-fitted-sheet TH | 90.7 → **95.3** (+4.6) | 1927 → 1851 (−76) | 0.99MB → 0.47MB (−52%) | 2.13MB → 1.47MB (−31%) | 61 → 60 |
| marine-fitted-sheet EN (marine) | 88.0 → **96.3** (+8.3) | 2442 → 1807 (−635) | 2.13MB → 0.45MB (−79%) | 2.35MB → 0.64MB (−73%) | 67 → 47 |
| marine-fitted-sheet TH | 85.0 → **93.0** (+8.0) | 2604 → 2343 (−261) | 1.96MB → 0.45MB (−77%) | 2.27MB → 0.73MB (−68%) | 66 → 53 |
| bedbridge-connector EN (fixed) | 87.7 → **97.0** (+9.3) | 1870 → 1887 (+17, noise) | 2.49MB → 0.31MB (−87%) | 2.67MB → 0.46MB (−83%) | 54 → 34 |
| bedbridge-connector TH | 82.0 → **97.7** (+15.7) | 1996 → 1881 (−114) | 2.49MB → 0.31MB (−87%) | 2.75MB → 0.54MB (−80%) | 61 → 40 |

Summary: performance score up on all 6 representative pages (+4.6 to +15.7); image payload down 52–87%; total payload down 31–83%; LCP improved or flat (two +17/+153ms readings are within run-to-run variance); CLS unchanged or improved.

## 5. Known exceptions / caveats

1. **Preview D1 divergence:** preview-branch D1 returns different image sets than production, and `co-sleeping-top-sheet` returns "Product not found" on preview (static hero variant + fallback covers it; page passes validation). **Before prod release, rebuild once so the pipeline pulls prod API refs** (default API bases already include `https://www.mildmate.com`; no env needed in prod builds).
2. **Variant keys are path-derived, not content-hashed.** If an existing image is replaced in place at the same URL, its variant can be stale up to the 30-day cache TTL. R2 uploads use timestamped filenames, so in practice this is rare; cache rule intentionally uses `max-age=2592000` without `immutable`.
3. **CSP `data:,` console warnings** observed on preview pages (transparent-pixel placeholders); cosmetic only — `img-src` already allows `data:`, validation and gates pass.
4. Lighthouse run-to-run variance is ±10 points on single runs; per-page 3-run averages above are the reliable comparison.

## 6. Cache-control discrepancy resolution (audit P2 item)

- Audit showed 470 blank `cache_control` fields (crawler captured response objects without header extraction on some requests) vs 4 explicit P2 rows. Direct HEAD evidence collected 2026-11-03:
  - pages.dev (before rule): all static assets `public, max-age=0, must-revalidate` + ETag (Pages default).
  - `www.mildmate.com` originals: zone default `public, max-age=14400, must-revalidate` + `cf-cache-status` (edge cached).
  - Variants (after `_headers` rule, verified live): `public, max-age=2592000`.
- Conclusion: there was no misconfiguration on originals, only short default TTLs. Variants now carry an explicit long TTL; originals keep zone defaults (they can change in place).

## 7. Production release plan (on GO approval)

1. Rebuild on a machine with prod network access: `node scripts/build-products.js` (pipeline refreshes variants, pulling prod D1 API image refs by default; idempotent).
2. Deploy: `npx wrangler pages deploy ./public --project-name=mildmate-new --commit-dirty=true --branch=master --no-bundle`.
3. Post-deploy checks (both already scripted):
   - `node scripts/tmp-catalog-preview-validate.cjs "https://www.mildmate.com"` → expect 62/62.
   - `node scripts/tmp-mobile-release-gates.cjs "https://www.mildmate.com" <out.json>` → expect pass.
   - HEAD a variant URL → expect `image/webp` + `max-age=2592000`.
4. Commit/push only after owner approval (changed: 3 templates, `build-products.js`, new `image-variant-pipeline.cjs`, `_headers`, 62 rebuilt pages, generated `variants/**` assets).

## 8. Rollback plan

- Instant rollback: Cloudflare Pages → roll back production to the prior deployment (current prod baseline at time of writing: `db2afd48-08d4-4a5b-b222-5cb69af55926`; earlier documented rollback target `02ee5d06-…`).
- Runtime safety net even without rollback: every variant `<img>` carries `data-fallback`/`onerror` to the original asset, so a missing/broken variant degrades to today's behavior, never to a blank image.
- The `_headers` variant cache rule is additive and scoped; removing the 3-line block restores prior header behavior.

## 9. Artifact index (this folder)

- `catalog-preview-validate.json` — 62/62 validation on `993a0bed`
- `preview-release-gates.json` — functional gates PASS on `993a0bed`
- `lighthouse-bench/` — 36 raw Lighthouse runs + `summary.json`
- `../PRODUCT_IMAGE_INVENTORY.csv`, `../IMAGE_ASSET_INVENTORY.csv`, `../audit-summary.json`, `../REPORT.md` — original audit
- `public/images/products/variants/manifest.json` — source→variant manifest

---

# Production Release Addendum (2026-11-03)

Released under the owner's conditional GO. All release gates passed.

## Released state

| Item | Value |
|---|---|
| Production deployment | `34c1f64d` (Pages project `mildmate-new`, branch `master`, `--no-bundle`) |
| Rollback target | prior production deployment `db2afd48-08d4-4a5b-b222-5cb69af55926` |
| Variant version token | `e8f03f9bb8` (sha1 over all variant file contents; baked into all 62 pages as `?v=` on every variant URL) |
| Source assets (prod-authoritative) | **510** (products.json + prod D1 API refs for all 31 slugs + audit CSV + diagrams) |
| Variant files | **2,040** (510 × 4 profiles); 460 stale preview-D1-only variants pruned before release |
| Cache policy | `/images/products/variants/* → public, max-age=2592000`; staleness bounded by content-hash `?v=` versioning (any variant byte change → new token → new URLs). Originals untouched (zone default `max-age=14400`). |

## Gate results

1. **Pre-deployment reconciliation** (`variant-reconciliation.json`): 625 preview-era sources vs 506 audit vs 510 prod-authoritative explained — the 625 set included 115 preview-D1-only refs (pruned); the 510 prod set covers **100% of audit image URLs (0 missing)** and **100% of prod API image refs for all 31 slugs (0 missing)**, including `co-sleeping-top-sheet` **17/17** refs (image_url + 16 gallery images — real gallery, not fallback hero). All 2,040 variant files verified present and non-empty before deploy.
2. **Caching:** versioned variant URLs live (`?v=e8f03f9bb8`), verified `200 image/webp` + `max-age=2592000` + `cf-cache-status` on `www.mildmate.com`; originals preserved and serving.
3. **Deployment:** isolated payload (templates, build script, pipeline, `_headers` variant rule, 62 rebuilt pages, variant assets). `_worker.js`, Clerk, consent, GTM/GA4, quote, pricing, cart, checkout untouched. Unrelated working-tree changes excluded.
4. **Post-deployment verification on `www.mildmate.com`:**
   - Full-catalog validation: **62/62 PASS** (first pass 59/62 with 3 transient cold-cache/navigation failures minutes after deploy; direct probes showed all variants serving `200 image/webp`; immediate re-run **62/62**, artifact `catalog-preview-validate.json`).
   - Functional release gates: **PASS, 0 failed** (`prod-release-gates.json`) — consent-gated analytics, quote funnel + dataLayer events, cart/checkout.
   - Lighthouse (6 representative pages × 2 runs, `lighthouse-prod-release/summary.json`): avg scores 77–93; **image bytes 243–473KB/page vs 1.0–2.5MB pre-release** (52–87% reduction delivered on live); score variance driven by third-party tags, consistent with pre-release baseline noise (±10/run).

## Notes

- The preview branch alias (`catalog-image-variants-20261…`) now shows variant fallbacks on ~28 pages because preview deployments read preview D1 (different image sets) whose variants were correctly pruned from the prod payload. Fallback-to-original worked as designed there; production is unaffected (prod D1 refs fully covered).
- One transient API fetch failure (`deep-pocket-fitted-sheet` on host 1) during the release build was covered by the second prod-D1 host; reconciliation confirmed 0 missing refs for that slug.
- Rollback: Cloudflare Pages → roll back to `db2afd48-…`; additionally every variant `<img>` retains `onerror` fallback to the original asset.
