# Prioritized Rollout Plan (Post-Pilot)

Date: 2026-11-03

## Phase 1 (P0): Customizable template rollout

Goal: eliminate full-res thumbnail dependency and add responsive slide variants across all customizable products.

Steps:
1. Move pilot logic into shared template path.
2. Add variant manifest generation for each gallery image base.
3. Generate `thumb`, `slide-640`, `slide-960` variants for each customizable product image set.
4. Validate EN/TH parity + quote/cart/checkout + consent/event gates.

Exit criteria:
- No customizable page uses original full-res URLs as thumbnail `src`.
- Real browser checks show thumbnail requests are variant paths.

## Phase 2 (P1): Shared diagram modernization

Re-prioritize the four common PNG diagrams to rollout **P1**:
- `Duvet.png`
- `measure-mattress-diagram-01.png`
- `Pillowcase.png`
- `measure-cushion-diagram-01.png`

Steps:
1. Ship modern variants (WebP, optional AVIF where safe).
2. Keep PNG fallback in markup only where required.
3. Re-test all affected pages.

Exit criteria:
- Shared diagram transfer reduced globally with no rendering regressions.

## Phase 3 (P2): Fixed + Marine template rollout

Steps:
1. Normalize marine carousel path to same variant contract.
2. Apply thumb/slide variant strategy to fixed template galleries.
3. Repeat the same measurement + gate suite per template family.

Exit criteria:
- Consistent variant behavior across all template families.

## Phase 4 (P3): Guardrail and automation

Steps:
1. Add a variant-generation helper for new product uploads.
2. Add a pre-release check to detect full-res thumbnail regressions.
3. Add periodic audit script run for image role compliance.

Exit criteria:
- New uploads automatically produce variant set.
- Regression checks prevent reintroduction of full-res thumbnail usage.