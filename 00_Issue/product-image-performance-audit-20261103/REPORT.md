# Product Image Performance Audit Report

Date: 2026-11-03  
Scope: `https://www.mildmate.com` product detail pages only (`/product/*` and `/th/product/*`)  
Mode: Read-only audit (no optimization changes applied in this phase)

## 1) Executive Summary

The catalog-wide audit covered **62 product URLs** (**31 EN + 31 TH**, 31 slugs) and identified **506 unique product-related image assets**.

Main finding: the dominant issue is not missing lazy loading, but **thumbnail strategy and source sizing**. Most carousel thumbnails still reference full gallery sources, which amplifies transfer size across all configurable products.

### Headline numbers

- Distinct assets analyzed: **506**
- Estimated distinct optimization opportunity: **36,327.0 KB (~35.5 MB)**
- Assets flagged `thumb-uses-large-source`: **487** (overlapping estimated opportunity: **34,368.8 KB**)
- Assets flagged `oversized(...)`: **313** (overlapping estimated opportunity: **25,746.4 KB**)
- PNG diagram assets with modern-format opportunity: **4** (estimated **1,958.2 KB**)
- Pages likely using full-res sources for thumbnails: **56/62**
- Marine template pages with separate/unknown thumb strategy path: **6/62**

## 2) Deliverables Generated

- `PRODUCT_IMAGE_INVENTORY.csv`
- `IMAGE_ASSET_INVENTORY.csv`
- `audit-summary.json`
- `lighthouse-samples/*.json`

All files are under:
`00_Issue/product-image-performance-audit-20261103/`

## 3) Methodology (Read-only)

1. Parsed live sitemap to build full EN/TH product URL set.
2. Collected product API image arrays (`/api/products/{slug}`) and resolved canonical asset URLs.
3. Parsed rendered product HTML image tags and attributes (`src`, `srcset`, `sizes`, `loading`, `fetchpriority`).
4. Captured display roles and approximate rendered dimensions via Playwright (mobile + desktop contexts).
5. Pulled asset metadata via HEAD/Range requests (format, bytes, cache headers, dimensions).
6. Estimated optimization potential per asset using conservative heuristics:
   - Oversized source-vs-display ratio
   - PNG modern-format conversion opportunity
   - Full-res source usage in thumbnail roles

## 4) Coverage Profile

### Page/template distribution

- `customizable`: **50** pages
- `marine`: **6** pages
- `fixed`: **6** pages

### Average image weight by template family (per page)

- `customizable`: **3,507.5 KB** average, **1,864.1 KB** estimated savings
- `marine`: **1,661.6 KB** average, **909.0 KB** estimated savings
- `fixed`: **1,245.6 KB** average, **670.1 KB** estimated savings

## 5) Highest-Impact Findings

### A. Thumbnail path is the largest multiplier

- **487/506 assets** are used in contexts where full-size images are also used as thumbnails.
- This pattern is present across almost all customizable product pages and both languages.
- Estimated opportunity tied to this pattern (overlapping): **34,368.8 KB**.

### B. Source dimensions are frequently larger than display need

- **313 assets** are oversized relative to display role.
- Common ratios in the dataset are roughly **2.5x to 3.6x** pixel area, with outliers beyond **5x**.

### C. Shared legacy PNG diagrams are heavy and reused

Top reusable diagram opportunities:

| Asset | Bytes | Est. savings | Pages using |
|---|---:|---:|---:|
| `common/Duvet.png` | 1,395,471 | 613.2 KB | 10 |
| `common/measure-mattress-diagram-01.png` | 1,374,827 | 604.2 KB | 30 |
| `common/Pillowcase.png` | 1,234,323 | 542.4 KB | 8 |
| `common/measure-cushion-diagram-01.png` | 293,361 | 198.4 KB | 2 |

### D. Cache header gaps exist, but are secondary

- Only **4 assets** fell into weak/missing cache-header priority (`P2`), and all were lower-impact than sizing/thumbnail issues.

## 6) Product-Level Hotspots (Per-Page Estimated Savings)

> EN and TH pages often mirror the same asset set, so page-level rows duplicate by language. Distinct opportunity is represented by the asset-level total (36,327 KB).

| Page (slug) | Template | Per-page weight | Est. savings | Priority |
|---|---|---:|---:|---|
| `pet-proof-mattress-protector` | customizable | 4,539.3 KB | 2,483.3 KB | P0 |
| `flat-sheet-extra-deep-pocket` | customizable | 4,407.5 KB | 2,425.7 KB | P0 |
| `duvet-cover-dorm` | customizable | 4,349.5 KB | 2,387.8 KB | P0 |
| `3-sided-duvet` | customizable | 4,252.2 KB | 2,264.2 KB | P0 |
| `rv-truck-fitted-sheet` | customizable | 4,130.8 KB | 2,238.3 KB | P0 |
| `marine-fitted-sheet` | marine | 2,045.4 KB | 1,138.4 KB | P0 |
| `marine-mattress-protector` | marine | 1,987.9 KB | 1,119.5 KB | P0 |
| `marine-top-sheet` | marine | 951.4 KB | 469.2 KB | P0 |

## 7) Asset-Level Priority Breakdown

- **P0:** 21 assets (hero-affecting + high potential)
- **P1:** 466 assets (major structural gallery/thumb opportunity)
- **P2:** 4 assets (cache header gap)
- **P3:** 15 assets (low/no immediate gain)

## 8) Lighthouse Sample Observations (Representative)

Sample set files:
- `mobile-sample-1.json` (EN cushion custom)
- `mobile-sample-2.json` (EN marine fitted)
- `mobile-sample-3.json` (EN bedbridge)
- `mobile-sample-4.json` (TH cushion custom)
- `desktop-sample-1.json` (EN cushion custom)

### Snapshot metrics

| Sample | Perf score | LCP (s) | Image transfer | Image requests |
|---|---:|---:|---:|---:|
| mobile-sample-1 | 94 | 2.58 | 2,253.4 KB | 41 |
| mobile-sample-2 | 87 | 2.48 | 2,344.3 KB | 43 |
| mobile-sample-3 | 95 | 1.81 | 2,421.8 KB | 33 |
| mobile-sample-4 | 90 | 2.65 | 1,832.6 KB | 32 |
| desktop-sample-1 | 99 | 0.77 | 1,142.2 KB | 27 |

Interpretation: Lighthouse scores are not catastrophic, but image transfer remains high for product pages, especially mobile product configurator flows.

## 9) Conclusions

1. **Largest ROI is standardizing thumbnail-specific variants and wiring thumbnail rendering away from full gallery sources.**
2. **Second ROI is responsive right-sizing for gallery/hero assets at build/upload time.**
3. **Shared diagram modernization (PNG → modern formats) is a quick global win due broad reuse.**
4. EN/TH duplication means each image fix typically benefits both languages at once.

## 10) Limitations

- This audit is read-only and does not include post-change validation deltas.
- Savings are heuristic estimates, not byte-for-byte transformed outputs.
- Some carousel behavior differs by template; marine pages were categorized separately.

---

Prepared from generated evidence in:
`00_Issue/product-image-performance-audit-20261103/`