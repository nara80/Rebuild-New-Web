# Cushion Pilot Report (Image Variant Strategy)

Date: 2026-11-03  
Scope: `custom-waterproof-cushion-protector` only (EN + TH), isolated preview only  
Preview alias: `https://pilot-cushion-image-variant.mildmate-new.pages.dev`

## 1) What was implemented

Implemented a pilot image-variant strategy only for:
- `public/product/custom-waterproof-cushion-protector/index.html`
- `public/th/product/custom-waterproof-cushion-protector/index.html`

Added new slide variants (kept originals unchanged):
- `public/images/products/custom-waterproof-cushion-protector/slides/*-640.webp`
- `public/images/products/custom-waterproof-cushion-protector/slides/*-960.webp`

Behavior changes in pilot pages:
- Thumbnails stay on dedicated small WebP files (`/thumbs/*.webp`) with original-image fallback.
- Hero + slides use responsive WebP slide variants (`640w/960w`) with preserved high-priority first slide and original fallback.
- Cushion gallery now has a deterministic fallback list to keep EN/TH behavior consistent when preview D1 gallery payload is sparse.

## 2) Measurement method

### Before
- Production URLs (current live baseline)
- 3 Lighthouse mobile runs each for EN + TH
- Real browser mobile network capture (Playwright)

### After
- Isolated pilot preview URL above
- 3 Lighthouse mobile runs each for EN + TH
- Real browser mobile network capture (Playwright)

Artifacts:
- `before/lighthouse/*.json`
- `after/lighthouse/*.json`
- `before/network-check.json`
- `after/network-check.json`
- `release-gates-pilot-preview.json`

## 3) Real browser network results (mobile)

| Page | Image transfer (KB) before | Image transfer (KB) after | Delta | Image req before | Image req after | Full-res req before | Full-res req after | Slide variant req after | Thumb using full-res after |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| EN cushion | 588.5 | 507.9 | -80.6 (-13.7%) | 44 | 39 | 8 | 7 | 3 | No |
| TH cushion | 586.5 | 507.5 | -79.0 (-13.5%) | 44 | 39 | 8 | 7 | 3 | No |

Network proof for thumbnail behavior:
- Thumbnail requests are `/thumbs/*.webp`.
- `thumbUsesFullRes=false` for EN and TH.
- Remaining full-res requests were **not** from cushion gallery base IDs (they were non-gallery page images).

## 4) Lighthouse mobile summary (3 runs per locale)

### EN
- Scores: before `94, 92, 87` → after `98, 98, 93` (median `92` → `98`)
- LCP (s): before `2.51, 2.54, 2.40` → after `1.91, 2.10, 2.32` (median `2.51` → `2.10`)

### TH
- Scores: before `93, 91, 88` → after `85, 93, 89` (median `91` → `89`)
- LCP (s): before `2.58, 2.57, 2.55` → after `2.53, 2.15, 2.33` (median `2.57` → `2.33`)

Notes:
- TH score spread remains volatile in simulated runs; real browser transfer/request metrics improved similarly for EN and TH.

## 5) Functional + analytics gates

Gate file: `release-gates-pilot-preview.json`  
Result: **PASS**

Validated:
- EN/TH configurator flow, pricing and quote flow (mocked quote submit in gate script)
- EN/TH add-to-cart + checkout shell smoke
- Consent/analytics behavior on preview host
- Event paths preserved in flow checks (`view_item`, `add_to_cart`, `quote_request`, `generate_lead`, mocked `purchase` path)

## 6) Shared PNG diagram reconciliation (from baseline audit)

Audit currently classifies these as `P3` heuristically, but they are high-leverage shared assets and should be promoted in rollout priority.

| Diagram | Current audit priority | Pages using | Est. savings |
|---|---|---:|---:|
| `common/Duvet.png` | P3 | 10 | 613.2 KB |
| `common/measure-mattress-diagram-01.png` | P3 | 30 | 604.2 KB |
| `common/Pillowcase.png` | P3 | 8 | 542.4 KB |
| `common/measure-cushion-diagram-01.png` | P3 | 2 | 198.4 KB |

**Reconciled pilot recommendation:** treat these as **rollout Priority P1** because of cross-page reuse and low implementation risk.

## 7) Pilot verdict

**Pilot status: PASS (preview-only).**  
Primary objective met: thumbnail paths no longer rely on full-res gallery sources, and responsive slide variants are now in use with safe fallback.

## 8) Single rollout recommendation

Proceed with **template-driven rollout to all customizable product pages first**, using this same variant contract (thumb + 640/960 slide variants + fallback) and shared generation tooling, then extend to fixed/marine templates in a second wave.