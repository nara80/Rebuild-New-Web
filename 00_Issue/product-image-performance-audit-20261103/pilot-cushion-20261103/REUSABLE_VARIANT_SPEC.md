# Reusable Variant Specification (All Product Templates)

Date: 2026-11-03

## A) Variant roles

1. **thumb**
- Purpose: carousel thumbnail only
- Format: WebP
- Target display: ~105x105 CSS px
- File pattern: `/thumbs/{base}.webp`
- Fallback: original source URL on error

2. **slide-640**
- Purpose: mobile hero/slide candidate
- Format: WebP
- Width target: 640w
- File pattern: `/slides/{base}-640.webp`

3. **slide-960**
- Purpose: tablet/desktop slide candidate
- Format: WebP
- Width target: 960w
- File pattern: `/slides/{base}-960.webp`

4. **original**
- Purpose: archival source and runtime fallback only
- Keep untouched; never delete in rollout

## B) Runtime selection contract

For each image item:
- `srcset`: `slide-640 640w, slide-960 960w`
- `sizes`: `(max-width: 768px) 92vw, (max-width: 1200px) 50vw, 620px`
- First slide: `loading=eager`, `fetchpriority=high`
- Non-first slides: lazy reveal with `data-src`, `data-srcset`, `data-sizes`
- All variant images: `data-fallback=<original>` + one-time error fallback

## C) Template-family adoption

- **customizable**: adopt full contract (highest priority)
- **fixed**: adopt thumb + slide contract where gallery exists
- **marine**: adopt after marine-specific carousel path normalization

## D) Non-functional requirements

- Preserve existing gallery UX (dots, swipe, thumb click, video slide behavior)
- Preserve quote/cart/configurator logic
- Do not change production analytics policy behavior
- No deletion of original R2 uploads