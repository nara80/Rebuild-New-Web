# Future Optimization Plan (Catalog-wide Product Images)

Date: 2026-11-03  
Scope: MildMate product pages (`/product/*`, `/th/product/*`)  
Source baseline: `product-image-performance-audit-20261103`

## Objectives

1. Reduce product-page image transfer, especially mobile configurator sessions.
2. Eliminate full-resolution assets from thumbnail rendering paths.
3. Standardize reusable variant rules across all product templates.
4. Preserve visual quality and avoid regressions in EN + TH parity.

## Guardrails

- Roll out by phase with measurable gates.
- Avoid layout-shift regressions.
- Keep rollback simple (variant fallback to original source).
- Apply identical behavior to EN and TH paths.

## Phase 0 — Baseline Freeze and Test Harness

**Actions**
- Freeze current audit artifacts as baseline.
- Add deterministic re-run scripts for:
  - inventory diff (`PRODUCT_IMAGE_INVENTORY.csv`, `IMAGE_ASSET_INVENTORY.csv`)
  - Lighthouse samples (same URL set)
- Define pass/fail thresholds for image transfer and LCP.

**Exit criteria**
- Baseline files committed for comparison.
- One-command re-run produces same report structure.

## Phase 1 — Canonical Image Variant Spec

**Actions**
- Define variant matrix by role:
  - `hero` (high quality, responsive widths)
  - `gallery-slide` (medium/high quality, responsive widths)
  - `gallery-thumb` (small fixed-size variants)
  - `related-card` (card-size variant)
  - `diagram` (optimized static modern-format)
- Keep original source as archival origin only, not UI default.
- Include format strategy (WebP primary, fallback where needed).

**Exit criteria**
- Every product asset role has a documented target dimension + quality profile.
- Variant naming convention is finalized.

## Phase 2 — Asset Pipeline Implementation

**Actions**
- Build/extend transform pipeline to generate variants for existing catalog assets.
- Batch process all high-impact assets first (P0/P1 from inventory).
- Produce manifest mapping `original -> role variants`.

**Exit criteria**
- 100% of active product slugs have required role variants.
- PNG diagrams in common path replaced with optimized modern equivalents (+ safe fallback handling).

## Phase 3 — Template and Runtime Wiring

**Actions**
- Update product rendering logic so thumbnails use thumb variants directly.
- Ensure hero/gallery use responsive `srcset` and `sizes` based on viewport.
- Align implementation across template families:
  - customizable
  - marine
  - fixed
- Keep lazy-loading logic but prevent eager full-res fetches from thumbnail interactions.

**Exit criteria**
- Full-res URLs are no longer assigned to thumbnail `src`/initial candidate paths.
- Marine pages follow equivalent optimized loading behavior.

## Phase 4 — Caching and Delivery Policy

**Actions**
- Enforce strong cache headers on immutable image variants.
- Verify CDN behavior for R2-backed assets and static `/images/products/*` assets.
- Confirm cache key/versioning strategy supports safe invalidation.

**Exit criteria**
- Near-zero assets with missing/weak cache headers.
- Repeat-visit image transfer shows material reduction.

## Phase 5 — Rollout Strategy

**Wave 1 (highest impact slugs)**
- pet-proof-mattress-protector
- flat-sheet-extra-deep-pocket
- duvet-cover-dorm
- 3-sided-duvet
- rv-truck-fitted-sheet
- marine-fitted-sheet
- marine-mattress-protector

**Wave 2**
- Remaining customizable slugs with high shared asset reuse.

**Wave 3**
- Fixed/accessory pages and tail assets.

**Exit criteria**
- Wave-by-wave metrics show downward trend in page image KB and no conversion-critical regressions.

## Phase 6 — Validation and Ongoing Governance

**Actions**
- Re-run inventory + Lighthouse sample set after each wave.
- Track KPI deltas in a simple release scoreboard:
  - median mobile image KB
  - median mobile LCP
  - total distinct asset estimated savings realized
- Add upload-time policy checks to prevent new oversized assets from entering catalog.

**Exit criteria**
- Sustained compliance and no reintroduction of full-res thumbnail usage.

## Suggested Success Targets

- Full-res thumbnail pattern removed on all product pages.
- Distinct image transfer opportunity reduced by at least ~25 MB from current baseline.
- Mobile product-page LCP trend improves and remains stable post-rollout.
- No visual quality or layout regressions in EN/TH product experiences.

## Dependencies

- Access to existing product build/runtime codepaths for template updates.
- Deterministic variant generation tooling (local CI-ready).
- QA bandwidth for visual and cross-device spot checks.

## Risks and Mitigations

- **Risk:** aggressive compression harms perceived quality.  
  **Mitigation:** per-role quality presets + visual approval gates.

- **Risk:** runtime candidate-selection bugs cause blank or delayed images.  
  **Mitigation:** fallback source chain and template-specific tests.

- **Risk:** cache/version mismatches serve stale assets.  
  **Mitigation:** versioned file names and controlled invalidation.